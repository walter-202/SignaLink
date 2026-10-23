# Modelos 3D locales

Coloca aquí un `avatar.glb` solo cuando el equipo tenga permiso documentado para
usarlo y redistribuirlo. El avatar incluido en `apps/web/public/avatars/` se
generó con assets CC0 de MakeHuman/MPFB; no se incluyen modelos ni animaciones
de terceros sin licencia.

El visor activo (`AvatarPreview`) usa `NEXT_PUBLIC_LSB_AVATAR_MODEL_URL`. Si la
variable está vacía, el avatar incluido en `apps/web/public/avatars/` queda
disponible para una carga explícita al solicitar el clip provisional de «Hola»;
no se descarga al entrar a la página. El valor `off` desactiva el GLB incluido.
Para sustituirlo, copia `apps/web/.env.example` a `apps/web/.env.local` y define:

```dotenv
NEXT_PUBLIC_LSB_AVATAR_MODEL_URL=/models/avatar.glb
```

La variable histórica `NEXT_PUBLIC_AVATAR_MODEL_URL` solo aplica al componente
`AvatarExperience`, que no está montado en la aplicación actual.

El modelo debe incluir el esqueleto y los clips que utilizará el visor. La
presencia de una animación no implica que corresponda a una seña LSB validada.
