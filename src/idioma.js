// Textos del juego en castellano, inglés y portugués. Se elige solo por el idioma del navegador
// (castellano si empieza con "es", portugués con "pt", inglés para todo lo demás).
// Para probar otro: ?idioma=en, ?idioma=pt, ?idioma=es.
const TEXTOS = {
  // portada (canvas, en mayúsculas: la fuente de píxeles no tiene minúsculas)
  practica: { es: 'PRÁCTICA', en: 'PRACTICE', pt: 'TREINO' },
  practicaSub: { es: 'CONTRA LA MÁQUINA', en: 'VS THE COMPUTER', pt: 'CONTRA O COMPUTADOR' },
  online: { es: 'ONLINE', en: 'ONLINE', pt: 'ONLINE' },
  onlineSub: { es: 'RIVAL AL AZAR · RANKING', en: 'RANDOM RIVAL · RANKED', pt: 'RIVAL ALEATÓRIO · RANKING' },
  amigo: { es: 'CON UN AMIGO', en: 'WITH A FRIEND', pt: 'COM UM AMIGO' },
  amigoSub: { es: 'POR LINK · SIN RANKING', en: 'SHARE A LINK · UNRANKED', pt: 'POR LINK · SEM RANKING' },
  ranking: { es: 'RANKING', en: 'RANKING', pt: 'RANKING' },
  entrarCanvas: { es: 'ENTRAR', en: 'SIGN IN', pt: 'ENTRAR' },
  mover: { es: 'MANEJAR', en: 'DRIVE', pt: 'DIRIGIR' },
  derrape: { es: 'DERRAPE', en: 'DRIFT', pt: 'DERRAPAR' },
  nitro: { es: 'NITRO', en: 'NITRO', pt: 'NITRO' },
  salto: { es: 'SALTO', en: 'JUMP', pt: 'PULO' },
  pausa: { es: 'PAUSA', en: 'PAUSE', pt: 'PAUSA' },
  sonido: { es: 'SONIDO', en: 'SOUND', pt: 'SOM' },
  girar: { es: 'GIRÁ EL CELU PARA JUGAR MEJOR', en: 'TURN YOUR PHONE FOR A BETTER VIEW', pt: 'GIRE O CELULAR PARA JOGAR MELHOR' },
  gana: { es: 'GANA EL PRIMERO EN HACER 3', en: 'FIRST TO 3 GOALS WINS', pt: 'VENCE QUEM FIZER 3 GOLS' },

  // panel de cuenta (HTML)
  comoJugar: { es: '¿Cómo querés jugar?', en: 'How do you want to play?', pt: 'Como você quer jogar?' },
  entrar: { es: 'Entrar', en: 'Sign in', pt: 'Entrar' },
  entrarSub: { es: 'Tu puesto te sigue a cualquier dispositivo.', en: 'Your rank follows you to any device.', pt: 'Sua posição te acompanha em qualquer aparelho.' },
  conMail: { es: 'Con mi mail', en: 'With my email', pt: 'Com meu e-mail' },
  invitado: { es: 'Jugar como invitado', en: 'Play as guest', pt: 'Jogar como convidado' },
  invitadoSub: { es: 'Solo un nombre. Te recuerda este navegador.', en: 'Just a name. This browser remembers you.', pt: 'Só um nome. Este navegador lembra de você.' },
  nombreTitulo: { es: 'Elegí tu nombre', en: 'Pick a name', pt: 'Escolha um nome' },
  nombreSub: { es: 'Es el que se ve en el ranking.', en: 'It shows up in the ranking.', pt: 'É o que aparece no ranking.' },
  nombreEj: { es: 'tu nombre', en: 'your name', pt: 'seu nome' },
  jugar: { es: 'Jugar', en: 'Play', pt: 'Jogar' },
  listo: { es: 'Listo', en: 'Done', pt: 'Pronto' },
  mailTitulo: { es: 'Entrar con tu mail', en: 'Sign in with email', pt: 'Entrar com e-mail' },
  mailSub: { es: 'Te mandamos un código de 6 números. No hay contraseña.', en: "We'll send you a 6-digit code. No password.", pt: 'Enviamos um código de 6 números. Sem senha.' },
  mailEj: { es: 'nombre@gmail.com', en: 'name@gmail.com', pt: 'nome@gmail.com' },
  mandar: { es: 'Mandame el código', en: 'Send me the code', pt: 'Enviar código' },
  revisa: { es: 'Revisá tu mail', en: 'Check your email', pt: 'Confira seu e-mail' },
  revisaSub: { es: 'Escribí el código que mandamos a {mail}. Si no aparece, mirá en spam.', en: "Enter the code we sent to {mail}. Check spam if it's not there.", pt: 'Digite o código enviado para {mail}. Se não chegar, olhe no spam.' },
  volver: { es: '← Volver', en: '← Back', pt: '← Voltar' },
  cerrar: { es: 'Cerrar', en: 'Close', pt: 'Fechar' },
  tuCuenta: { es: 'Tu cuenta', en: 'Your account', pt: 'Sua conta' },
  unida: { es: 'Entraste con {x}. En otro dispositivo entrá igual y seguís con el mismo puesto.', en: 'Signed in with {x}. Sign in the same way on another device to keep your rank.', pt: 'Você entrou com {x}. Em outro aparelho, entre do mesmo jeito para manter sua posição.' },
  sinUnir: { es: 'Ahora solo te recuerda este navegador. Entrá para no perder tu puesto.', en: 'Only this browser remembers you. Sign in to keep your rank.', pt: 'Só este navegador lembra de você. Entre para não perder sua posição.' },
  otraForma: { es: 'También podés entrar con:', en: 'You can also sign in with:', pt: 'Você também pode entrar com:' },
  google: { es: 'Google', en: 'Google', pt: 'Google' },
  tuMail: { es: 'tu mail', en: 'your email', pt: 'seu e-mail' },
  y: { es: ' y ', en: ' and ', pt: ' e ' },
  salir: { es: 'Salir en este navegador', en: 'Sign out on this browser', pt: 'Sair neste navegador' },
  // errores
  e_mail: { es: 'Ese mail no parece bien escrito.', en: "That email doesn't look right.", pt: 'Esse e-mail parece errado.' },
  e_espera: { es: 'Esperá un minuto para pedir otro código.', en: 'Wait a minute before asking for another code.', pt: 'Espere um minuto para pedir outro código.' },
  e_muchos: { es: 'Pediste muchos códigos. Probá más tarde.', en: 'Too many codes. Try again later.', pt: 'Códigos demais. Tente mais tarde.' },
  e_envio: { es: 'No se pudo mandar el mail. Probá en un rato.', en: "Couldn't send the email. Try again soon.", pt: 'Não deu para enviar o e-mail. Tente daqui a pouco.' },
  e_codigo: { es: 'El código no coincide.', en: "That code doesn't match.", pt: 'O código não confere.' },
  e_vencido: { es: 'El código venció. Pedí otro.', en: 'The code expired. Ask for a new one.', pt: 'O código expirou. Peça outro.' },
  e_google: { es: 'Google no confirmó la cuenta. Probá de nuevo.', en: "Google didn't confirm the account. Try again.", pt: 'O Google não confirmou a conta. Tente de novo.' },
  e_nombre: { es: 'De 2 a 16 letras o números.', en: '2 to 16 letters or numbers.', pt: 'De 2 a 16 letras ou números.' },
  e_humano: { es: 'No pudimos confirmar que no sos un robot. Probá de nuevo.', en: "We couldn't confirm you're not a robot. Try again.", pt: 'Não deu para confirmar que você não é um robô. Tente de novo.' },
  e_servidor: { es: 'Algo falló. Probá de nuevo.', en: 'Something went wrong. Try again.', pt: 'Algo deu errado. Tente de novo.' },
};

function detectar() {
  const pedido = new URLSearchParams(location.search).get('idioma');
  const lista = [pedido, ...(navigator.languages || [navigator.language])].filter(Boolean).map((l) => l.toLowerCase());
  for (const l of lista) {
    if (l.startsWith('es')) return 'es';
    if (l.startsWith('pt')) return 'pt';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}
export const IDIOMA = detectar();
document.documentElement.lang = IDIOMA;

export function t(clave, vars = {}) {
  const e = TEXTOS[clave];
  let s = e ? e[IDIOMA] ?? e.en : clave;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
