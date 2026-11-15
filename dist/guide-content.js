(function (root) {
  'use strict';
  const chapters = [
    {id:'images',title:{es:'1. Los colores',en:'1. The colors'},heading:{es:'Leo el color de cada zona',en:'I read each area’s color'},
      es:'Cada punto de la imagen guarda un color RGB: rojo, verde y azul. Lo comparo con la paleta de NASA para estimar si esa zona está más fría o cálida que su promedio de 1951–1980. El blanco marca la referencia. Para resumir un grupo de píxeles válidos, tomo su valor central, la mediana.',
      en:'Each pixel stores a color as red, green and blue values: RGB. I compare it with NASA’s palette to estimate whether that area is cooler or warmer than its 1951–1980 average. White marks the reference. To summarize a group of valid pixels, I take their middle value—the median.'},
    {id:'temperature',title:{es:'2. La temperatura',en:'2. Temperature'},heading:{es:'De frío y calor a agudo y grave',en:'From cooler and warmer to higher and lower'},
      es:'Ahora escucho esos colores contigo. El frío vuelve la música más aguda y el calor, más grave: me inspiro en estudios sobre cómo relacionamos los sentidos, llamados correspondencias crossmodales. Aquí el calor también acelera la pieza y el frío la frena. Esa velocidad es una elección artística del proyecto, no una regla de esos estudios.',
      en:'Now let’s listen to those colors. Cooler areas make the music higher in pitch; warmer areas make it lower. This draws on studies of how we link the senses, known as crossmodal correspondences. Here, warmth also speeds up the piece and cold slows it down. That tempo rule is an artistic choice, not a finding from those studies.'},
    {id:'harmony',title:{es:'3. La armonía',en:'3. Harmony'},heading:{es:'Vivaldi me inspira un contraste',en:'Vivaldi inspires a contrast'},
      es:'Primavera y Otoño tienen tonalidades principales mayores; Verano e Invierno, menores. Ese contraste de Vivaldi inspira las melodías de los paisajes de impactos: uso el modo mayor cerca de la referencia y el menor desde ±1,5 °C. En el mapa geográfico, en cambio, la pieza MIDI mantiene su armonía original.',
      en:'Spring and Autumn have major home keys; Summer and Winter have minor ones. That contrast in Vivaldi inspires the impact soundscapes’ melodies: I use major near the reference and minor at ±1.5 °C and beyond. On the geographic map, the MIDI piece keeps its original harmony.'},
    {id:'heartbeat',title:{es:'4. El latido',en:'4. The heartbeat'},heading:{es:'Un latido para sentir la diferencia',en:'A heartbeat to give the difference a pulse'},
      es:'El latido es mi manera de dar presencia al cambio. Cerca del promedio va tranquilo; cuando la diferencia crece, late más rápido y, en los extremos, se vuelve irregular. Responde tanto al frío como al calor. Es una metáfora sonora, no el pulso real de la Tierra ni un diagnóstico.',
      en:'The heartbeat gives the change a sense of presence. Near the average, it is steady and calm. As the difference grows, it beats faster; at the extremes, it becomes irregular. It responds to both cold and warmth. This is a sound metaphor, not Earth’s actual pulse or a medical diagnosis.'}
  ];
  const impacts = {
    water:{es:'Elegí violines de arco suave por su movimiento continuo: me recuerdan agua que corre, como los arroyos que Vivaldi pintó con cuerdas.',en:'I chose gently bowed violins for their continuous motion. They suggest flowing water, like the streams Vivaldi painted with strings.'},
    biodiversity:{es:'Un ecosistema se reconoce por sus voces. Por eso alterno aves, rana e insecto; con anomalías extremas queda una sola llamada.',en:'An ecosystem has many voices. That is why I alternate birds, a frog and an insect; at extreme anomalies, only one type of call remains.'},
    forests:{es:'Las cuerdas con sordina sugieren hojas que se mueven; flauta y clarinete parecen aves entre ramas. Me inspira Murmullos del bosque de Wagner.',en:'Muted strings suggest rustling leaves, while flute and clarinet evoke birds among the branches. Wagner’s Forest Murmurs is the inspiration.'},
    oceans:{es:'El arpa dibuja olas, las cuerdas prolongan su movimiento y los metales aportan amplitud: una paleta inspirada en La mer de Debussy.',en:'The harp traces waves, the strings sustain their motion, and the brass adds breadth: a palette inspired by Debussy’s La mer.'},
    marine:{es:'Elegí flauta y violonchelo por sus inflexiones largas: crean un lamento instrumental que evoca ballenas, inspirado en Vox Balaenae de George Crumb.',en:'I chose flute and cello for their long, bending phrases. They create an instrumental lament that evokes whales, inspired by George Crumb’s Vox Balaenae.'},
    humans:{es:'Quise que lo humano tuviera voces humanas. El grupo vocal se escucha unido cerca de la referencia y se fragmenta con anomalías más intensas.',en:'I wanted human voices to represent people. The vocal group sounds united near the reference, then fragments as anomalies become more extreme.'},
    ice:{es:'Las gotas, una campana delicada y los crujidos de hielo cuentan fragilidad y ruptura: su textura se vuelve más inquieta al alejarse del promedio, con frío o calor.',en:'Drops, a delicate bell and cracking ice tell a story of fragility and rupture. Their texture grows more unsettled further from the average, in both cold and warm conditions.'},
    economy:{es:'La economía tiene aquí una marcha industrial: bombo, caja y golpes de metal sugieren trabajo y maquinaria. Conservé un pulso reconocible.',en:'Economy has an industrial march: bass drum, snare and metallic strikes suggest work and machinery. I kept its pulse recognizable.'}
  };
  const exact = {
    'Una experiencia de':'An experience by','Neurociencia, arte y tecnología':'Neuroscience, art and technology',
    'La alien te cuenta cómo lo hicimos ↓':'Let the alien show you how it works ↓','Tu guía de escucha':'Your listening guide',
    'De los colores a la música':'From color to music','Elige un paso y te cuento cómo transformamos el mapa.':'Choose a step and I’ll show you how we turn the map into sound.',
    'Pasos de la guía':'Guide steps','La alien acompaña la explicación con gestos.':'The alien gestures along with the explanation.',
    'Pausar guía':'Pause guide animation','Animar guía':'Play guide animation','Por qué elegí estos sonidos':'Why I chose these sounds',
    'La alien te cuenta':'The alien explains','Más sobre estos sonidos':'More about these sounds',
    'Lecturas aproximadas de temperatura local; no son mediciones de los impactos ni equivalen al calentamiento global.':'These are approximate readings of local temperature, not measurements of impacts or global warming.',
    'Volver al mapa ↑':'Back to the map ↑'
  };
  for(const c of chapters){exact[c.title.es]=c.title.en;exact[c.heading.es]=c.heading.en;exact[c.es]=c.en;}
  for(const i of Object.values(impacts))exact[i.es]=i.en;
  root.PulsoGuideContent={chapters,impacts};root.PulsoGuideTranslations={exact};
})(window);
