# Modelos 3D locales

Coloca aquí un `avatar.glb` solo cuando el equipo tenga permiso documentado para
usarlo y redistribuirlo. No se incluyen modelos ni animaciones de terceros en
este repositorio.

Para cargarlo al iniciar la aplicación, copia `apps/web/.env.example` a
`apps/web/.env.local` y define:

```dotenv
NEXT_PUBLIC_AVATAR_MODEL_URL=/models/avatar.glb
```

El modelo debe incluir el esqueleto y los clips que utilizará el visor. La
presencia de una animación no implica que corresponda a una seña LSB validada.
