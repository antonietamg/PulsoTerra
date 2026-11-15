"""Parse a user-provided Standard MIDI File and export a timed browser score.

Python standard library only. No audio is synthesized and the source MIDI is
copied byte-for-byte. MIDI channels/programs are zero-based. velocity preserves
the original note-on velocity divided by 127; CC events remain separate.

Usage: python prepare-vivaldi.py [--input FILE] [--dist DIRECTORY] [--self-test]
"""
from __future__ import annotations

import argparse
import bisect
from collections import Counter, defaultdict, deque
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct


GM = {
    0: "piano", 6: "harpsichord", 40: "violin", 41: "viola", 42: "cello",
    43: "contrabass", 44: "tremolo_strings", 45: "pizzicato_strings",
    46: "harp", 48: "strings", 49: "slow_strings", 68: "oboe",
    71: "clarinet", 73: "flute", 79: "ocarina",
}


def instrument(program: int, channel: int | None = None) -> str:
    return "percussion" if channel == 9 else GM.get(program, "gm_program_" + str(program))


def vlq(data: bytes, pos: int) -> tuple[int, int]:
    value = 0
    for _ in range(4):
        if pos >= len(data):
            raise ValueError("Truncated MIDI variable-length quantity")
        byte = data[pos]
        pos += 1
        value = (value << 7) | (byte & 127)
        if byte < 128:
            return value, pos
    raise ValueError("MIDI variable-length quantity exceeds four bytes")


def text_value(payload: bytes) -> str:
    try:
        return payload.decode("utf-8").rstrip("\0")
    except UnicodeDecodeError:
        return payload.decode("cp1252", errors="replace").rstrip("\0")


def parse_tracks(data: bytes):
    if len(data) < 14 or data[:4] != b"MThd":
        raise ValueError("Not a Standard MIDI File (missing MThd)")
    header_length = struct.unpack_from(">I", data, 4)[0]
    if header_length < 6 or 8 + header_length > len(data):
        raise ValueError("Invalid MIDI header length")
    fmt, count, division = struct.unpack_from(">HHH", data, 8)
    if fmt not in (0, 1):
        raise ValueError("Only synchronous SMF formats 0 and 1 are supported")
    if not division or division & 0x8000:
        raise ValueError("Expected a positive PPQ time division, not SMPTE timing")
    if not count or (fmt == 0 and count != 1):
        raise ValueError("Invalid SMF track count")
    offset = 8 + header_length
    tracks, events, warnings = [], [], []
    while offset < len(data) and len(tracks) < count:
        if offset + 8 > len(data):
            raise ValueError("Truncated MIDI chunk header")
        kind = data[offset:offset + 4]
        length = struct.unpack_from(">I", data, offset + 4)[0]
        start, end = offset + 8, offset + 8 + length
        if end > len(data):
            raise ValueError("Truncated MIDI track data")
        offset = end
        if kind != b"MTrk":
            warnings.append("Skipped non-track chunk " + repr(kind))
            continue
        payload = data[start:end]
        track_index, pos, tick, order, running = len(tracks), 0, 0, 0, None
        track = {"id": "track-" + str(track_index), "index": track_index,
                 "name": "", "endTick": 0, "metadata": []}
        found_end = False
        while pos < len(payload):
            delta, pos = vlq(payload, pos)
            tick += delta
            if pos >= len(payload):
                raise ValueError("Missing MIDI event after delta time")
            status = payload[pos]
            if status >= 128:
                pos += 1
            elif running is not None:
                status = running
            else:
                raise ValueError("Running-status event has no channel status")
            event = {"tick": tick, "track": track_index, "order": order}
            order += 1
            if status == 0xFF:
                if pos >= len(payload):
                    raise ValueError("Missing meta-event type")
                meta_type = payload[pos]
                pos += 1
                size, pos = vlq(payload, pos)
                if pos + size > len(payload):
                    raise ValueError("Truncated MIDI meta event")
                value = payload[pos:pos + size]
                pos += size
                event.update(kind="meta", metaType=meta_type, payload=value)
                if meta_type in (1, 2, 3, 4, 5, 6, 7):
                    text = text_value(value)
                    track["metadata"].append({"type": meta_type, "tick": tick, "text": text})
                    if meta_type == 3 and not track["name"]:
                        track["name"] = text
                if meta_type == 0x51 and (size != 3 or not int.from_bytes(value, "big")):
                    raise ValueError("Invalid MIDI tempo event")
                events.append(event)
                if meta_type == 0x2F:
                    if size:
                        raise ValueError("End-of-track event must have zero length")
                    found_end = True
                    if pos != len(payload):
                        warnings.append("Bytes after end-of-track in " + track["id"])
                    break
                # SMF meta events do not replace the last channel running status.
            elif status in (0xF0, 0xF7):
                size, pos = vlq(payload, pos)
                if pos + size > len(payload):
                    raise ValueError("Truncated MIDI SysEx event")
                value = payload[pos:pos + size]
                pos += size
                running = None
                events.append(dict(event, kind="sysex", status=status, payload=value))
            elif 0x80 <= status <= 0xEF:
                running = status
                message, channel = status >> 4, status & 15
                size = 1 if message in (0xC, 0xD) else 2
                if pos + size > len(payload):
                    raise ValueError("Truncated MIDI channel event")
                value = payload[pos:pos + size]
                pos += size
                if any(v > 127 for v in value):
                    raise ValueError("Invalid MIDI data byte")
                events.append(dict(event, kind="channel", message=message,
                                   channel=channel, data=tuple(value)))
            else:
                raise ValueError("Unsupported system event in SMF: " + hex(status))
        track["endTick"] = tick
        if not found_end:
            warnings.append("Missing end-of-track event in " + track["id"])
        tracks.append(track)
    if len(tracks) != count:
        raise ValueError("MIDI header/track count mismatch")
    if offset != len(data):
        warnings.append("Trailing bytes after declared MIDI tracks")
    events.sort(key=lambda e: (e["tick"], e["track"], e["order"]))
    return fmt, division, tracks, events, warnings


def parse_smf(data: bytes, filename: str = "The-Four-Seasons.mid") -> dict:
    fmt, ppq, raw_tracks, events, warnings = parse_tracks(data)
    file_end = max(t["endTick"] for t in raw_tracks)
    tempo_ticks = {0: 500000}
    for event in events:
        if event["kind"] == "meta" and event["metaType"] == 0x51:
            tempo_ticks[event["tick"]] = int.from_bytes(event["payload"], "big")
    tempo_positions = sorted(tempo_ticks)
    tempo_times, elapsed = [], 0.0
    for i, tick in enumerate(tempo_positions):
        if i:
            last = tempo_positions[i - 1]
            elapsed += (tick - last) / ppq * tempo_ticks[last] / 1_000_000
        tempo_times.append(elapsed)

    def seconds(tick):
        i = bisect.bisect_right(tempo_positions, tick) - 1
        base = tempo_positions[i]
        return tempo_times[i] + (tick - base) / ppq * tempo_ticks[base] / 1_000_000

    def rounded(value):
        return round(float(value), 9)

    programs = [0] * 16
    sustain = [False] * 16
    active, pending = defaultdict(deque), defaultdict(list)
    notes_raw, controllers, program_changes, bends = [], [], [], []
    channel_events, orphan_off, sustain_extended = Counter(), 0, 0

    def finish(note, tick):
        nonlocal sustain_extended
        note["endTick"] = max(tick, note["tick"])
        if tick > note.get("keyOffTick", tick):
            sustain_extended += 1
        notes_raw.append(note)

    def release(note, tick):
        note["keyOffTick"] = tick
        if sustain[note["channel"]]:
            pending[note["channel"]].append(note)
        else:
            finish(note, tick)

    def flush_pending(channel, tick):
        for note in pending.pop(channel, []):
            finish(note, tick)

    for event in events:
        if event["kind"] != "channel":
            continue
        message, ch, values, tick, tr = event["message"], event["channel"], event["data"], event["tick"], event["track"]
        channel_events[message] += 1
        if message == 0xC:
            programs[ch] = values[0]
            program_changes.append({"time": rounded(seconds(tick)), "beat": rounded(tick / ppq),
                                    "track": "track-" + str(tr), "channel": ch,
                                    "program": values[0], "instrument": instrument(values[0], ch)})
        elif message == 0x9 and values[1] > 0:
            active[(tr, ch, values[0])].append({"tick": tick, "track": tr, "channel": ch,
                                             "midi": values[0], "rawVelocity": values[1], "program": programs[ch]})
        elif message == 0x8 or (message == 0x9 and values[1] == 0):
            key = tr, ch, values[0]
            if active[key]:
                release(active[key].popleft(), tick)
            else:
                orphan_off += 1
        elif message == 0xB:
            controller, value = values
            controllers.append({"time": rounded(seconds(tick)), "beat": rounded(tick / ppq),
                                "track": "track-" + str(tr), "channel": ch,
                                "controller": controller, "value": value})
            if controller == 64:
                was = sustain[ch]
                sustain[ch] = value >= 64
                if was and not sustain[ch]:
                    flush_pending(ch, tick)
            elif controller == 121:
                sustain[ch] = False
                flush_pending(ch, tick)
            elif controller == 120:
                for key, queue in active.items():
                    if key[1] == ch:
                        while queue:
                            finish(queue.popleft(), tick)
                flush_pending(ch, tick)
            elif controller in (123, 124, 125, 126, 127):
                for key, queue in active.items():
                    if key[1] == ch:
                        while queue:
                            release(queue.popleft(), tick)
        elif message == 0xE:
            bends.append({"time": rounded(seconds(tick)), "beat": rounded(tick / ppq),
                          "track": "track-" + str(tr), "channel": ch,
                          "value": values[0] | (values[1] << 7)})

    dangling = sum(len(q) for q in active.values())
    for queue in active.values():
        while queue:
            note = queue.popleft()
            finish(note, raw_tracks[note["track"]]["endTick"])
    for ch in list(pending):
        flush_pending(ch, file_end)
    if orphan_off:
        warnings.append(str(orphan_off) + " unmatched note-off events")
    if dangling:
        warnings.append(str(dangling) + " unclosed notes ended at track end")

    notes = []
    for n in sorted(notes_raw, key=lambda n: (n["tick"], n["track"], n["channel"], n["midi"])):
        start, end = seconds(n["tick"]), seconds(n["endTick"])
        if end <= start:
            warnings.append("Zero-length note retained at tick " + str(n["tick"]))
        notes.append({"time": rounded(start), "duration": rounded(end - start),
                      "beat": rounded(n["tick"] / ppq), "beats": rounded((n["endTick"] - n["tick"]) / ppq),
                      "midi": n["midi"], "velocity": round(n["rawVelocity"] / 127, 9),
                      "track": "track-" + str(n["track"]), "channel": n["channel"],
                      "program": n["program"], "instrument": instrument(n["program"], n["channel"]),
                      "sustainExtended": n["endTick"] > n.get("keyOffTick", n["endTick"])})
    tracks = []
    for t in raw_tracks:
        chosen = [n for n in notes if n["track"] == t["id"]]
        channels = sorted({n["channel"] for n in chosen})
        used_programs = sorted({n["program"] for n in chosen})
        instruments = sorted({n["instrument"] for n in chosen})
        tracks.append({"id": t["id"], "name": t["name"] or ("Conductor / meta" if not channels else "Pista " + str(t["index"] + 1)),
                       "channel": channels[0] if len(channels) == 1 else None,
                       "program": used_programs[0] if len(used_programs) == 1 else None,
                       "instrument": instruments[0] if len(instruments) == 1 else "mixed" if instruments else "meta",
                       "programs": used_programs, "instruments": instruments, "channels": channels,
                       "noteCount": len(chosen), "endBeat": rounded(t["endTick"] / ppq)})
    meta = [{"track": t["id"], "type": m["type"], "beat": rounded(m["tick"] / ppq),
             "time": rounded(seconds(m["tick"])), "text": m["text"]}
            for t in raw_tracks for m in t["metadata"]]
    title_meta = next((m["text"] for m in meta if m["track"] == "track-0" and m["type"] == 3 and m["text"]), None)
    markers = [m for m in meta if m["type"] in (6, 7)]
    first = min((n["time"] for n in notes), default=0)
    last = max((n["time"] + n["duration"] for n in notes), default=0)
    score = {"title": title_meta or Path(filename).stem.replace("-", " "), "fileName": Path(filename).name,
             "sha256": hashlib.sha256(data).hexdigest(), "format": fmt, "ppq": ppq,
             "durationBeats": rounded(file_end / ppq), "durationSeconds": rounded(seconds(file_end)),
             "tempos": [{"beat": rounded(tick / ppq), "bpm": rounded(60_000_000 / tempo_ticks[tick]),
                         "time": rounded(tempo_times[i])} for i, tick in enumerate(tempo_positions)],
             "tracks": tracks, "notes": notes, "controllers": controllers, "programChanges": program_changes,
             "pitchBends": bends, "textMetadata": meta, "markers": markers,
             "firstNoteSeconds": rounded(first), "lastNoteEndSeconds": rounded(last),
             "activeSpanSeconds": rounded(last - first), "trailingSilenceSeconds": rounded(seconds(file_end) - last),
             "titleSource": "sequence-title meta event" if title_meta else "filename (no sequence-title meta event)",
             "indexing": {"channel": "zero-based (0..15)", "program": "General MIDI zero-based (0..127)", "track": "physical SMF track ID"},
             "metrics": {"physicalTracks": len(raw_tracks), "musicalTracks": sum(t["noteCount"] > 0 for t in tracks),
                         "notes": len(notes), "sustainControllerEvents": sum(c["controller"] == 64 for c in controllers),
                         "sustainExtendedNotes": sustain_extended, "unmatchedNoteOffs": orphan_off,
                         "unclosedNotes": dangling, "sysexEvents": sum(e["kind"] == "sysex" for e in events),
                         "controllerCounts": dict(sorted(Counter(c["controller"] for c in controllers).items()))},
             "warnings": warnings}
    return score


def self_test():
    def variable(n):
        out = [n & 127]
        while n >> 7:
            n >>= 7
            out.insert(0, (n & 127) | 128)
        return bytes(out)

    def event(delta, data):
        return variable(delta) + data

    def file_for(parts, ppq=96):
        return b"MThd" + struct.pack(">IHHH", 6, 1 if len(parts) > 1 else 0, len(parts), ppq) + b"".join(b"MTrk" + struct.pack(">I", len(p)) + p for p in parts)

    end = b"\xFF\x2F\x00"
    # Running status, zero-velocity note-off and a real program number.
    raw = file_for([event(0, b"\xC0\x28") + event(0, b"\x90\x3C\x64") + event(96, b"\x3C\x00") + event(0, end)])
    s = parse_smf(raw)
    assert len(s["notes"]) == 1 and s["notes"][0]["program"] == 40
    assert s["notes"][0]["duration"] == .5 and s["notes"][0]["midi"] == 60
    # Tempo changes from another synchronous track must affect a held note.
    conductor = event(0, b"\xFF\x51\x03\x07\xA1\x20") + event(96, b"\xFF\x51\x03\x0F\x42\x40") + event(96, end)
    melody = event(0, b"\x90\x3D\x50") + event(192, b"\x80\x3D\x00") + event(0, end)
    s = parse_smf(file_for([conductor, melody]))
    assert s["notes"][0]["duration"] == 1.5 and s["tempos"][1]["time"] == .5
    # CC64 holds a released key until pedal-up; threshold 64 is on, 63 is off.
    pedal = event(0, b"\xB0\x40\x40") + event(0, b"\x90\x3C\x64") + event(96, b"\x80\x3C\x00") + event(96, b"\xB0\x40\x3F") + event(0, end)
    s = parse_smf(file_for([pedal]))
    assert s["notes"][0]["duration"] == 1 and s["notes"][0]["sustainExtended"]
    assert s["metrics"]["sustainExtendedNotes"] == 1
    # Repeated identical keys overlap: FIFO note-off matching preserves both.
    repeated = event(0, b"\x90\x3C\x64") + event(48, b"\x3C\x50") + event(48, b"\x80\x3C\x00") + event(48, b"\x3C\x00") + event(0, end)
    s = parse_smf(file_for([repeated]))
    assert len(s["notes"]) == 2 and [n["duration"] for n in s["notes"]] == [.5, .5]
    # Program changes are captured per note, not flattened to a track default.
    changed = event(0, b"\xC0\x2D") + event(0, b"\x90\x3C\x64") + event(96, b"\x80\x3C\x00") + event(0, b"\xC0\x30") + event(0, b"\x90\x40\x64") + event(96, b"\x80\x40\x00") + event(0, end)
    s = parse_smf(file_for([changed]))
    assert [n["program"] for n in s["notes"]] == [45, 48] and s["tracks"][0]["program"] is None
    try:
        parse_smf(raw[:-1])
    except ValueError:
        pass
    else:
        raise AssertionError("Truncated SMF was accepted")
    print("PASS: running status, velocity-zero note-off, cross-track tempo map, sustain threshold/release, overlapping keys, program changes and truncation.")


def build(source: Path, dist: Path):
    original = source.read_bytes()
    score = parse_smf(original, source.name)
    music = dist / "assets" / "music"
    music.mkdir(parents=True, exist_ok=True)
    target = music / source.name
    shutil.copyfile(source, target)
    assert target.read_bytes() == original and source.read_bytes() == original
    score["midiUrl"] = "assets/music/" + source.name
    script = "window.VivaldiScore = " + json.dumps(score, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n"
    score_path = dist / "vivaldi-score.js"
    score_path.write_text(script, encoding="utf-8", newline="\n")
    score_json_path = music / "score.json"
    score_json_path.write_text(json.dumps(score, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8", newline="\n")
    attribution = "Archivo MIDI proporcionado por usuario"
    provenance = {"source": {"filename": source.name, "sha256": score["sha256"], "bytes": len(original), "attribution": attribution},
                  "originalCopy": {"filename": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "byteIdentical": True},
                  "score": {"filename": "vivaldi-score.js", "sha256": hashlib.sha256(score_path.read_bytes()).hexdigest(),
                            "bytes": score_path.stat().st_size, "dataFile": "score.json", "title": score["title"],
                            "titleSource": score["titleSource"], "format": score["format"], "ppq": score["ppq"],
                            "durationBeats": score["durationBeats"], "durationSeconds": score["durationSeconds"],
                            "firstNoteSeconds": score["firstNoteSeconds"], "lastNoteEndSeconds": score["lastNoteEndSeconds"],
                            "trailingSilenceSeconds": score["trailingSilenceSeconds"], "metrics": score["metrics"]},
                  "tempos": score["tempos"], "tracks": score["tracks"], "programChanges": score["programChanges"],
                  "movementIdentification": "No movement names/markers are declared in this file. Its filename alone does not establish that all four concertos are present.",
                  "processing": "SMF event extraction using prepare-vivaldi.py (Python standard library); original pitches, note-on velocities, programs and tempo-map timing retained. CC64 extends note durations if present. Controller/pitch-bend events remain explicit. No audio synthesized or inferred score sections added.",
                  "references": ["https://midi.org/standard-midi-files", "https://midi.org/midi-1-0-control-change-messages"],
                  "warnings": score["warnings"]}
    (music / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    # Verification of the complete exported data contract, not just its header.
    assert len(score["notes"]) == score["metrics"]["notes"]
    assert all(math.isfinite(n["time"]) and n["time"] >= 0 and n["duration"] >= 0 and 0 < n["velocity"] <= 1 for n in score["notes"])
    assert all(a["time"] <= b["time"] for a, b in zip(score["notes"], score["notes"][1:]))
    assert all(n["track"] in {t["id"] for t in score["tracks"]} for n in score["notes"])
    print(json.dumps({"title": score["title"], "metrics": score["metrics"], "tempos": score["tempos"],
                      "durationSeconds": score["durationSeconds"], "firstNoteSeconds": score["firstNoteSeconds"],
                      "lastNoteEndSeconds": score["lastNoteEndSeconds"], "trailingSilenceSeconds": score["trailingSilenceSeconds"],
                      "notePrograms": dict(Counter(n["program"] for n in score["notes"])), "scoreBytes": score_path.stat().st_size,
                      "warnings": score["warnings"]}, ensure_ascii=False, indent=2))
    return score


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path.home() / "Downloads" / "The-Four-Seasons.mid")
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parent / "dist")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    build(args.input, args.dist)
