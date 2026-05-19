export default function LeafBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>

      {/* Hoja grande — esquina superior izquierda */}
      <svg viewBox="0 0 400 500" className="absolute -top-16 -left-20 w-72 md:w-96 opacity-30"
        fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M200,10 C320,10 390,100 370,220 C350,340 260,430 180,460
                 C100,490 30,440 10,360 C-10,280 20,180 60,120 C100,60 160,10 200,10 Z"
          fill="#2d6e20"/>
        <path d="M200,10 C200,10 180,120 170,180 C160,240 155,320 180,460"
          stroke="#1a4a12" strokeWidth="3" opacity="0.5"/>
        <path d="M200,10 C200,10 250,80 290,130 C330,180 360,200 370,220"
          stroke="#1a4a12" strokeWidth="2" opacity="0.4"/>
        <path d="M200,10 C200,10 140,70 100,110 C60,150 20,200 10,260"
          stroke="#1a4a12" strokeWidth="2" opacity="0.4"/>
      </svg>

      {/* Hoja grande — esquina superior derecha, girada */}
      <svg viewBox="0 0 400 500" className="absolute -top-10 -right-24 w-80 md:w-[28rem] opacity-25"
        style={{ transform: 'rotate(140deg)' }}
        fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M200,10 C320,10 390,100 370,220 C350,340 260,430 180,460
                 C100,490 30,440 10,360 C-10,280 20,180 60,120 C100,60 160,10 200,10 Z"
          fill="#3a8228"/>
        <path d="M200,10 C200,10 180,120 170,180 C160,240 155,320 180,460"
          stroke="#256018" strokeWidth="3" opacity="0.5"/>
      </svg>

      {/* Hoja tropical — esquina inferior derecha */}
      <svg viewBox="0 0 500 600" className="absolute -bottom-20 -right-16 w-80 md:w-[26rem] opacity-30"
        style={{ transform: 'rotate(200deg)' }}
        fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M60,590 C60,590 80,400 160,280 C240,160 380,80 440,20
                 C440,20 480,160 420,280 C360,400 200,460 140,560 C120,590 60,590 60,590 Z"
          fill="#256a1a"/>
        <path d="M60,590 C80,500 150,350 280,200 C380,90 440,20 440,20"
          stroke="#1a4a12" strokeWidth="3" opacity="0.5"/>
        <path d="M200,380 C240,340 300,290 360,240"
          stroke="#1a4a12" strokeWidth="2" opacity="0.4"/>
        <path d="M140,460 C180,420 240,380 310,330"
          stroke="#1a4a12" strokeWidth="2" opacity="0.4"/>
      </svg>

      {/* Hoja pequeña — esquina inferior izquierda */}
      <svg viewBox="0 0 300 380" className="absolute -bottom-10 -left-10 w-48 md:w-64 opacity-25"
        style={{ transform: 'rotate(30deg)' }}
        fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M150,10 C240,10 290,80 275,170 C260,260 200,330 140,355
                 C80,380 20,340 8,270 C-5,200 20,120 55,70 C90,20 130,10 150,10 Z"
          fill="#4a9030"/>
        <path d="M150,10 C150,10 135,100 128,150 C120,200 118,270 140,355"
          stroke="#2d6018" strokeWidth="2.5" opacity="0.5"/>
      </svg>

      {/* Hoja media — lado derecho centro */}
      <svg viewBox="0 0 260 340" className="absolute top-1/3 -right-8 w-40 md:w-52 opacity-20"
        style={{ transform: 'rotate(260deg)' }}
        fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M130,8 C200,8 250,70 238,150 C226,230 172,295 118,318
                 C64,340 16,304 5,238 C-5,172 18,100 50,58 C82,16 116,8 130,8 Z"
          fill="#3a8228"/>
        <path d="M130,8 C130,8 115,90 108,140 C101,190 100,255 118,318"
          stroke="#256018" strokeWidth="2" opacity="0.5"/>
      </svg>

    </div>
  )
}
