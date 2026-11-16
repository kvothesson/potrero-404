// Identificador público del juego en Google (no es secreto: Google lo muestra en la página).
// Se saca de console.cloud.google.com → Credenciales → ID de cliente de OAuth (aplicación web).
// Vacío = el botón de Google no aparece y solo se puede entrar con el mail.
export const GOOGLE_CLIENT_ID = '547350307466-el8rpkp307dvkbh8t9u97j8ejej26tss.apps.googleusercontent.com';

// Verificación anti-bots de Cloudflare (Turnstile, invisible) antes de mandar un código por mail.
// La clave del sitio es pública; la secreta está en el servidor. En la PC no se usa.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAGDMXNQencT7U6bN';
