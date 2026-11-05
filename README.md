# TOTP Autofill

**🇬🇧 English version below → [Go to English](#english-version)**

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

---

# English version

**🇪🇸 [Volver al español](#totp-autofill)**

**Chrome** and **Brave** extension (Manifest V3) that generates TOTP 2FA codes, compatible with Google Authenticator, and fills them in on the website you're on.

- Imports your Google Authenticator export directly.
- Fills in the code with one click or a keyboard shortcut.
- Stores your secrets encrypted (AES-256) with a master password, with no servers or network connections.

> ℹ️ The extension's interface is only available in Spanish. This guide shows each label as it appears on screen, followed by its English meaning in parentheses.

## Requirements

- [Git](https://git-scm.com/downloads)
- Google Chrome or Brave (any recent version)

## Installation

### 1. Clone the repository

Choose a folder where it can stay permanently: the browser loads the extension from there, so **don't delete or move it** after installing.

```bash
git clone https://github.com/raul-anton-2005/totp-autofill.git
cd totp-autofill
```

> If you don't use Git, click **Code → Download ZIP** on GitHub and unzip it into a permanent folder.

### 2. Open the extensions page

Type this in the address bar:

| Browser | Address |
|---|---|
| Chrome | `chrome://extensions` |
| Brave | `brave://extensions` |

### 3. Turn on developer mode

Turn on the **Developer mode** switch (top right).

### 4. Load the extension

Click **Load unpacked** and select the `totp-autofill` folder you cloned: the one containing `manifest.json`.

### 5. Pin it to the toolbar

Click the puzzle icon 🧩 in the toolbar, then the pin 📌 next to **TOTP Autofill**.

## Initial setup

### Create the master password

Open the extension and choose a master password of **10 characters or more**. It's used to encrypt your secrets.

> ⚠️ If you forget it, there is no way to recover it. You would have to remove the extension and import your accounts from your phone again.

### Import your accounts from Google Authenticator

Exporting **doesn't delete** anything from your phone: the accounts stay in Authenticator and keep generating the same codes. If you're asked at the end whether to remove the exported accounts, choose to **keep them**.

1. On your phone: Google Authenticator → menu → **Transfer accounts** → **Export accounts**. Select the accounts and tap **Next**.
2. One or more QR codes will appear. Android doesn't allow screenshots of that screen, so use **another device**:
   - **Option A:** take a photo of the QR code with another phone, transfer it to your computer, and in the extension click **＋ → Leer QR de imagen** (read QR from image). If your browser doesn't support this, use option B.
   - **Option B:** scan the QR code with another phone's camera (the Camera app on iPhone, Google Lens on Android) and copy the `otpauth-migration://offline?data=…` text. Transfer it to your computer, paste it into **＋ → Importar URI** (import URI) and click **Importar** (import).
3. If there were several QR codes, repeat step 2 for each one.
4. Compare a couple of codes with the ones on your phone: they must be identical.

> 🔐 The `otpauth-migration://…` text contains **all** your secrets. If you send it through WhatsApp or Telegram to get it onto your computer, delete the message on both devices as soon as you've imported it.

### Add a new account

When a website shows you the QR code to set up 2FA, look for a link along the lines of *"Can't scan it?"*: it shows the **secret as text**. Paste it into **＋ → Manual**. If you also want the account on your phone, scan the QR code with Authenticator too.

## Usage

| Action | How |
|---|---|
| Fill in the code | Open the extension → **Rellenar** (fill). Accounts for the current website appear at the top, with a blue border |
| Fill in the first one on the list | **Enter** in the search box |
| Copy the code | Click the code |
| Fill in without opening the popup | **Alt+Shift+O** (only if a single account matches the website) |
| Link an account to a domain | **⋯** on the account → type the domain (e.g. `github.com`) → **Guardar** (save) |
| Lock | 🔒. It also locks itself after 15 minutes of inactivity |

If the code has 3 seconds or less left, the extension fills in the **next** one so it doesn't expire as you submit it.

**Keyboard shortcut badges on the icon:**

| Badge | Meaning |
|---|---|
| `OK` | Filled in |
| `NO` | Couldn't find the code field |
| `?` | No account matches the website; assign it the domain with ⋯ |
| `2+` | Several accounts match; use the popup |
| `LOCK` | Locked; open the extension and unlock it |

You can change the shortcut at `chrome://extensions/shortcuts` (or `brave://extensions/shortcuts`).

## Updating

```bash
cd totp-autofill
git pull
```

Then, in `chrome://extensions`, click the reload button ↻ on **TOTP Autofill**. Your accounts are kept.

## Uninstalling

In `chrome://extensions`, click **Remove** on **TOTP Autofill**. This **deletes the encrypted vault** with all your accounts. To keep them, first export a copy from **⚙ → Mostrar URIs** (show URIs).

## Security

- **Encryption:** secrets are stored with **AES-GCM 256**. The key is derived from the master password with **PBKDF2-SHA256 (600,000 iterations)**.
- **Unlocked key:** kept in memory only (`chrome.storage.session`). It's never written to disk, it's cleared when the browser closes, and web pages can't access it.
- **Minimal permissions:** the extension has no permanent permissions on any website. With `activeTab`, it can only access the current tab when you click the button or use the shortcut. It makes no network requests.
- **Inherent limitation:** if you keep your password and your 2FA in the same browser, a compromised computer (malware, a malicious extension) can steal both. For critical accounts (main email, bank, domain registrar), keep 2FA **on your phone only**.
- **Backups:** **⚙ → Mostrar URIs** (show URIs) exports your secrets **in plain text**. Treat them like passwords.

## Project structure

```
manifest.json        MV3; permissions: storage, activeTab, scripting, clipboardWrite
background.js        keyboard shortcut → fill
popup.html/.css/.js  interface
lib/totp.js          TOTP (RFC 6238), Base32, otpauth:// and otpauth-migration:// parser (protobuf)
lib/vault.js         encrypted vault and auto-lock
lib/match.js         account-to-domain matching
lib/fill.js          field detection and filling (one-time-code, single-digit boxes, heuristics)
icons/               icons
```

## Known limitations

- Only TOTP is supported (no HOTP or Steam Guard).
- It may not reach fields inside iframes from another domain. If so, copy the code to the clipboard.
- It doesn't work on `chrome://` pages, the Chrome Web Store, or other internal browser pages; Chrome prevents it.
