(function(root){
  'use strict';
  const exact={
    'Accesibilidad':'Accessibility','Alto contraste':'High contrast','Texto grande':'Large text',
    'Activar alto contraste':'Turn on high contrast','Desactivar alto contraste':'Turn off high contrast',
    'Usar tamaño de texto estándar':'Use standard text size','Usar texto grande (125 %)':'Use large text (125%)',
    'Saltar al explorador accesible':'Skip to the accessible explorer','Saltar al banco de sonidos':'Skip to the sound library',
    'Accesos de escucha':'Listening shortcuts','Explorar sin mirar el mapa':'Explore without looking at the map',
    'Ir a reproducción':'Go to playback','Elegir año':'Choose a year',
    'Explorar con teclado o lector de pantalla':'Explore with a keyboard or screen reader',
    'Aquí puedes elegir mapa o categoría, año y región, o fila y columna. Pulsa Consultar zona y después Escuchar esta zona. Tab cambia de control. Los selectores conservan tu elección durante la música. Cambiar fila o columna borra la región. Usa Pausar todo el audio para detenerla.':'Choose a map or soundscape, a year, and a region or a row and column. Select Check this area, then Listen to this area. Tab moves between controls. Your choices stay in place while music plays. Changing a row or column clears the region. Use Pause all audio to stop playback.',
    'Mapa o categoría':'Map or soundscape','Mapa geográfico · Vivaldi':'Geographic map · Vivaldi','Año':'Year','Región o punto de referencia':'Region or reference point','Elegir una región':'Choose a region',
    'Fila':'Row','Columna':'Column','Consultar zona':'Check this area','Zona anterior':'Previous area','Zona siguiente':'Next area',
    'Anunciar lectura actual':'Announce the current reading','Escuchar esta zona':'Listen to this area',
    'Pausar todo el audio':'Pause all audio','Escuchar recorrido completo':'Play the full tour',
    'Escuchar al avanzar entre zonas':'Play audio when moving between areas',
    'Anunciar lecturas durante el recorrido, cada cuatro segundos como máximo':'Announce readings during playback, no more than once every four seconds',
    'La lectura indica una anomalía aproximada respecto a 1951–1980. Las zonas sin datos se identifican y permanecen en silencio. Puedes pausar la música para escuchar tu lector de pantalla.':'The reading is an approximate anomaly relative to 1951–1980. Areas with no data are identified and remain silent. You can pause the music to hear your screen reader.',
    'Océano Ártico':'Arctic Ocean','Antártida':'Antarctica','Atlántico norte':'North Atlantic',
    'Atlántico sur':'South Atlantic','Pacífico norte':'North Pacific','Pacífico sur':'South Pacific',
    'Océano Índico':'Indian Ocean','Océano Austral':'Southern Ocean',
    'Todo el audio en pausa':'All audio paused','Escuchando la zona elegida':'Playing the selected area',
    'Escucha de la zona terminada':'Area playback finished','Sin datos · esta zona permanece en silencio':'No data · this area remains silent',
    'Región elegida · pulsa Escuchar Vivaldi para escuchar':'Region selected · press Listen to Vivaldi to listen'
  };
  const regions=[
    ['Estados Unidos y Canadá','United States and Canada'],['México y Centroamérica','Mexico and Central America'],
    ['Caribe','Caribbean'],['Sudamérica andina','Andean South America'],['Brasil y Sudamérica tropical atlántica','Brazil and tropical Atlantic South America'],
    ['Cono Sur','Southern Cone'],['Europa','Europe'],['Norte de África y Asia occidental','North Africa and West Asia'],
    ['África occidental y central','West and Central Africa'],['África oriental y austral','East and Southern Africa'],
    ['Asia central','Central Asia'],['Asia meridional','South Asia'],['Asia oriental','East Asia'],['Sudeste asiático','Southeast Asia'],
    ['Australia y Nueva Zelanda','Australia and New Zealand'],['Islas del Pacífico','Pacific Islands']
  ];
  for(const [es,en]of regions)exact['Explorar '+es]='Explore '+en;
  root.PulsoAccessibilityTranslations={exact};
})(window);
