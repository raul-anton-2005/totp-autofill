# TOTP Autofill

Extensión para **Chrome** y **Brave** (Manifest V3) que genera códigos 2FA TOTP, compatibles con Google Authenticator, y los rellena en la web en la que estás.

- Importa directamente la exportación de Google Authenticator.
- Rellena el código con un clic o con un atajo de teclado.
- Guarda los secretos cifrados (AES-256) con una contraseña maestra, sin servidores ni conexiones de red.

---

## Requisitos

- [Git](https://git-scm.com/downloads)
- Google Chrome o Brave (cualquier versión reciente)

## Instalación

### 1. Clona el repositorio

Elige una carpeta en la que vaya a quedarse de forma permanente: el navegador carga la extensión desde ahí, así que **no la borres ni la muevas** después de instalarla.

```bash
git clone https://github.com/raul-anton-2005/totp-autofill.git
cd totp-autofill
```

> Si no usas Git, en GitHub pulsa **Code → Download ZIP** y descomprímelo en una carpeta fija.

### 2. Abre la página de extensiones

Escribe en la barra de direcciones:

| Navegador | Dirección |
|---|---|
| Chrome | `chrome://extensions` |
| Brave | `brave://extensions` |

### 3. Activa el modo desarrollador

Activa el interruptor **Modo desarrollador** (arriba a la derecha).

### 4. Carga la extensión

Pulsa **Cargar descomprimida** y selecciona la carpeta `totp-autofill` que clonaste: la que contiene `manifest.json`.

### 5. Fíjala en la barra

Pulsa el icono del puzle 🧩 de la barra y luego la chincheta 📌 junto a **TOTP Autofill**.

## Configuración inicial

### Crea la contraseña maestra

Abre la extensión y elige una contraseña maestra de **10 caracteres o más**. Con ella se cifran tus secretos.

> ⚠️ Si la olvidas, no hay forma de recuperarla. Tendrías que borrar la extensión y volver a importar las cuentas desde el móvil.

### Importa tus cuentas desde Google Authenticator

Exportar **no borra** nada del móvil: las cuentas siguen en Authenticator y generan los mismos códigos. Si al final te pregunta si quieres eliminar las cuentas exportadas, elige **mantenerlas**.

1. En el móvil: Google Authenticator → menú → **Transferir cuentas** → **Exportar cuentas**. Selecciona las cuentas y pulsa **Siguiente**.
2. Aparecerán uno o varios códigos QR. En Android no se pueden hacer capturas de esa pantalla, así que usa **otro dispositivo**:
   - **Opción A:** haz una foto del QR con otro móvil, pásala al ordenador y en la extensión pulsa **＋ → Leer QR de imagen**. Si tu navegador no lo soporta, usa la opción B.
   - **Opción B:** escanea el QR con la cámara de otro móvil (en iPhone con la cámara, en Android con Google Lens) y copia el texto `otpauth-migration://offline?data=…`. Pásalo al ordenador, pégalo en **＋ → Importar URI** y pulsa **Importar**.
3. Si salieron varios QR, repite el paso 2 con cada uno.
4. Compara un par de códigos con los del móvil: tienen que ser idénticos.

> 🔐 El texto `otpauth-migration://…` contiene **todos** tus secretos. Si lo envías por WhatsApp o Telegram para pasarlo al ordenador, borra el mensaje en ambos dispositivos en cuanto lo importes.

### Añade una cuenta nueva

Cuando una web te muestre el QR para activar el 2FA, busca el enlace del tipo *"¿No puedes escanearlo?"*: muestra el **secreto en texto**. Pégalo en **＋ → Manual**. Si quieres tener también la cuenta en el móvil, escanea además el QR con Authenticator.

## Uso

| Acción | Cómo |
|---|---|
| Rellenar el código | Abre la extensión → **Rellenar**. Las cuentas de la web actual salen arriba, con borde azul |
| Rellenar el primero de la lista | **Enter** en el buscador |
| Copiar el código | Clic sobre el código |
| Rellenar sin abrir el popup | **Alt+Shift+O** (solo si una única cuenta coincide con la web) |
| Asociar una cuenta a un dominio | **⋯** en la cuenta → escribe el dominio (p. ej. `github.com`) → **Guardar** |
| Bloquear | 🔒. Además se bloquea sola tras 15 min sin uso |

Si al código le quedan 3 s o menos, la extensión rellena el **siguiente** para que no caduque al enviarlo.

**Distintivos del atajo de teclado en el icono:**

| Distintivo | Significado |
|---|---|
| `OK` | Rellenado |
| `NO` | No encontró el campo del código |
| `?` | Ninguna cuenta coincide con la web; asígnale el dominio con ⋯ |
| `2+` | Coinciden varias cuentas; usa el popup |
| `LOCK` | Bloqueada; abre la extensión y desbloquéala |

El atajo se cambia en `chrome://extensions/shortcuts` (o `brave://extensions/shortcuts`).

## Actualizar

```bash
cd totp-autofill
git pull
```

Después, en `chrome://extensions`, pulsa el botón de recarga ↻ de **TOTP Autofill**. Tus cuentas se conservan.

## Desinstalar

En `chrome://extensions`, pulsa **Quitar** en **TOTP Autofill**. Esto **borra el almacén cifrado** con todas las cuentas. Si quieres conservarlas, exporta antes una copia desde **⚙ → Mostrar URIs**.

## Seguridad

- **Cifrado:** los secretos se guardan con **AES-GCM 256**. La clave se deriva de la contraseña maestra con **PBKDF2-SHA256 (600 000 iteraciones)**.
- **Clave desbloqueada:** se guarda solo en memoria (`chrome.storage.session`). No se escribe en disco, se borra al cerrar el navegador y las páginas web no tienen acceso a ella.
- **Permisos mínimos:** la extensión no tiene permisos permanentes sobre ninguna web. Con `activeTab` solo puede acceder a la pestaña actual cuando tú pulsas el botón o el atajo. No hace ninguna petición de red.
- **Limitación de base:** si guardas la contraseña y el 2FA en el mismo navegador, un equipo comprometido (malware, una extensión maliciosa) puede llevarse los dos. Para cuentas críticas (correo principal, banco, registrador de dominios) mantén el 2FA **solo en el móvil**.
- **Copias de seguridad:** **⚙ → Mostrar URIs** exporta los secretos **en texto plano**. Trátalos como contraseñas.

## Estructura del proyecto

```
manifest.json        MV3; permisos: storage, activeTab, scripting, clipboardWrite
background.js        atajo de teclado → rellenar
popup.html/.css/.js  interfaz
lib/totp.js          TOTP (RFC 6238), Base32, parser otpauth:// y otpauth-migration:// (protobuf)
lib/vault.js         almacén cifrado y bloqueo automático
lib/match.js         coincidencia entre cuenta y dominio
lib/fill.js          detección y relleno del campo (one-time-code, casillas de 1 dígito, heurística)
icons/               iconos
```

## Limitaciones conocidas

- Solo admite TOTP (no HOTP ni Steam Guard).
- Puede no llegar a campos dentro de iframes de otro dominio. En ese caso copia el código al portapapeles.
- No funciona en `chrome://`, en la Chrome Web Store ni en otras páginas internas del navegador; Chrome lo impide.
