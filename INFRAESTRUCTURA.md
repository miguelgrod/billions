# Billions — alojamiento propio

El proyecto **salió de Bonitu el 2026-08-24**: repositorio
(`miguelgrod/billions`), bucket y distribución propios. El historial se extrajo
con `git subtree split --prefix=billions`, así que los 34 commits originales
siguen aquí.

| | Bonitu (padre) | Billions |
|---|---|---|
| Bucket | `bonituplay` | **`billions-cine`** |
| Región | us-east-1 | **eu-west-1** (Irlanda) |
| CloudFront | `E3LRZQIIEJH24` | **`EJYIWS894T0ZX`** → `d1qd7dxsg5ongd.cloudfront.net` |
| Dominio | `bonitu.es` | **`ganoyo.com`** (y `www.`) |
| Certificado | — | ACM **us-east-1**, `4bb07d7d-dd49-43ba-8f81-a65b2c5f4be7` |
| Usuario que despliega | el de Bonitu | `billions-deploy`, acotado a este proyecto |
| Workflow | `deploy.yml` en `miguelgrod/bonitu` | `deploy.yml` en `miguelgrod/billions` |

## Estado

**En pie desde el 2026-08-24 en https://ganoyo.com** — bucket, distribución,
certificado, dominio y despliegue propios.

## Cómo se creó (consola de AWS)

### 1. El bucket

1. **S3 → Crear bucket**
2. Nombre `billions-cine`, región **Europa (Irlanda) eu-west-1**
3. **Bloquear todo el acceso público: DEJARLO ACTIVADO.** No es un descuido: el
   bucket no se abre a internet, sólo lo lee CloudFront mediante OAC. Es más
   seguro que el patrón antiguo de bucket público, y obliga a que todo el
   tráfico pase por HTTPS.
4. El resto por defecto → Crear

### 2. La distribución de CloudFront

5. **CloudFront → Crear distribución**
6. **Origen**: elegir `billions-cine.s3.eu-west-1.amazonaws.com`.
   **Ojo: el endpoint REST, no el de "website hosting".** El de website es
   HTTP a secas y no funciona con OAC.
7. **Acceso al origen** → *Origin access control settings (recomendado)* →
   *Crear nuevo OAC* → aceptar los valores por defecto
8. CloudFront avisa de que hay que actualizar la política del bucket: pulsar
   **Copiar política**, ir a S3 → `billions-cine` → Permisos → Política del
   bucket → pegar y guardar
9. **Protocolo del visor**: *Redirect HTTP to HTTPS*
10. **Política de caché**: crear una propia —por ejemplo `billions-con-query`—
    con **cadenas de consulta: Todas**.
    **Esto no es opcional.** Los `<script src>` llevan la versión en la
    consulta (`main.js?v=d9ac259b`); con la política `CachingOptimized`, que
    ignora la consulta, CloudFront devolvería el archivo viejo para la URL
    nueva y el despliegue no se notaría. Es el mismo fallo que ya nos mordió
    en el navegador, un piso más arriba.
11. **Objeto raíz predeterminado**: `index.html`
12. **Clase de precio**: sólo Norteamérica y Europa (más barato; el público
    está aquí)
13. Crear y esperar a que despliegue. Apuntar el **ID de la distribución** y
    el **dominio** (`dXXXXXXXX.cloudfront.net`)

### 2b. Lo que el asistente nuevo NO pregunta

El asistente de la consola no ofrece estos dos campos; se ponen después en
**Distribución → General → Settings → Edit**:

- **Default root object: `index.html`.** Sin esto, la raíz devuelve un error.
- **Price class: sólo Norteamérica y Europa.** Por defecto paga nodos en Asia,
  Oceanía y Sudamérica que aquí no se usan.

### 2c. El dominio

`ganoyo.com` está registrado en **Dinahosting**, no en Route 53, así que el
certificado y el DNS se hicieron a mano:

- **El certificado va en ACM y obligatoriamente en `us-east-1`**: es la única
  región desde la que CloudFront los lee. Uno emitido en Irlanda no aparece en
  la lista de la distribución. Se pidieron los dos nombres a la vez.
- **Validación por DNS**: dos CNAME en Dinahosting, cuyo panel añade el dominio
  solo — en *Host* va sólo la parte izquierda, y en el del `www` hay que
  acordarse del sufijo `.www`. **Esos dos registros no se borran nunca**: sin
  ellos el certificado no se renueva.
- **La raíz se resolvió con un registro ANAME**, que Dinahosting ofrece. El DNS
  estándar no admite CNAME en la raíz, y un registro A no vale porque las
  direcciones de CloudFront cambian solas. Sin ANAME habría hecho falta redirigir
  la raíz a `www` o mudar el DNS a Route 53.
- Los registros A de la página aparcada (`@` y `www` → `82.98.135.44`) se
  borraron: un nombre no puede tener a la vez un A y un ANAME/CNAME.

### 3. Conectar el despliegue

14. En GitHub → Settings → Secrets and variables → Actions → **Variables** →
    nueva variable `BILLIONS_CF_ID` con el ID de la distribución
    (`EJYIWS894T0ZX`).
    Mientras no exista, el workflow despliega igual y se salta **dos** pasos: la
    invalidación y la configuración de las páginas de error.

    **Sigue pendiente, comprobado el 2026-08-29**: `/noexiste.html` y
    `/lo/que/sea` devuelven el XML de `AccessDenied` de S3 en vez de la página
    de error. Son tres filas en la consola y arreglan Billions y Perfect Nine a
    la vez.

    `404.html` y `500.html` ya están en el bucket,
    pero una URL inventada sigue devolviendo el XML de S3 (`403 AccessDenied`,
    `x-cache: Error from cloudfront`). **Hay que configurarlo a mano**: se probó
    a hacerlo desde el workflow y el usuario de despliegue no tiene permiso
    (`UpdateDistribution`), así que el job fallaba entero. Distribución →
    **Error pages** → Create custom error response, tres veces:

    | Código HTTP | Página          | Código de respuesta | TTL |
    |---|---|---|---|
    | 403 | `/404.html` | 404 | 10 |
    | 404 | `/404.html` | 404 | 10 |
    | 500 | `/500.html` | 500 | 0  |

    **El 403 no es opcional**: con OAC el bucket no da permiso de listado, así
    que un objeto que no existe se responde como 403 y no como 404. Sin esa
    fila, la página de error no se ve nunca.

### 4. El usuario que despliega

**Usuario propio, no el de Bonitu.** Reutilizar aquellas llaves volvería a atar
los dos proyectos justo por donde se separaron, y además GitHub no deja
recuperar el valor de un secreto ya guardado.

Usuario IAM `billions-deploy`, sin acceso a la consola, con esta política y
nada más:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "ListarElBucket", "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::billions-cine" },
    { "Sid": "EscribirElSitio", "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::billions-cine/*" },
    { "Sid": "InvalidarLaCache", "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::859741819165:distribution/EJYIWS894T0ZX" }
  ]
}
```

Sus llaves van a los secretos `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` del
repositorio. Si falta un permiso, el workflow falla nombrando la acción exacta.

## El segundo juego, en /mlb/

Desde el 2026-08-28 el repo lleva un juego más, **Perfect Nine** (quiz de la
MLB), en `mlb/`. Se despliega con el mismo workflow y se sirve en el mismo
bucket, en `https://ganoyo.com/mlb/index.html`. Su documentación está en
[mlb/CLAUDE.md](mlb/CLAUDE.md).

- **El sync excluye `mlb/tools/*` y `mlb/cache/*`.** El primero son scripts de
  Python que no pintan nada en un sitio web; el segundo son ~200 MB de datos
  crudos de la MLB Stats API, que además están en `.gitignore` y por tanto
  nunca llegan al runner.
- **`/mlb/` a secas no funciona: hay que poner `/mlb/index.html`.** Con OAC, el
  bucket no da permiso de listado y CloudFront no busca el documento índice
  dentro de una carpeta, así que devuelve **403** —y el 403 está mapeado a
  `/404.html`—. Se comprueba en un segundo: `/posters/` y `/imgs/` responden lo
  mismo.
- **Tiene su propio proyecto de Supabase** para la clasificación
  (`umuzzbcmcwhcdbbfobms`, Irlanda), encendido el 2026-08-29. No comparte nada
  con el de Billions: ni tabla, ni función, ni claves. Los pasos y las pruebas
  están en [mlb/supabase/README.md](mlb/supabase/README.md).
- **Para que la carpeta a secas funcione** hay que añadir una CloudFront
  Function asociada al *viewer request* del comportamiento por defecto:

  ```js
  function handler(event) {
    var req = event.request;
    if (req.uri.endsWith('/')) req.uri += 'index.html';
    else if (!req.uri.includes('.')) req.uri += '/index.html';
    return req;
  }
  ```

  Se crea en CloudFront → Functions, se publica y se asocia a la distribución
  `EJYIWS894T0ZX`. **Va a mano, como las páginas de error**, y por el mismo
  motivo: el usuario `billions-deploy` sólo tiene `CreateInvalidation`.

## Trampas conocidas

- **`aws s3 sync --delete` no borra lo que está excluido.** Si añades un archivo
  a la lista de `--exclude` y ese archivo **ya estaba en el bucket**, se queda
  ahí para siempre: el sync deja de subirlo, pero también deja de considerarlo
  para el borrado. Pasó con `.gitignore` y hubo que quitarlo a mano desde la
  consola. Si excluyes algo nuevo, comprueba si ya estaba publicado.
- **La consola de S3 te devuelve a la región del bucket.** Estando en la página
  del bucket, cambiar la región arriba a la derecha no sirve de nada: a los
  cinco segundos te redirige de vuelta a Irlanda. Para ir a otra región, entra
  por URL directa (`https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1`).

## Decisiones que conviene no deshacer

- **Los Excel de origen, `tools/` y la documentación no se suben.** Hoy se
  sirven en `bonitu.es/billions/` —`top_50_actores_numero_peliculas.xlsx`
  responde 200— y no pintan nada en un sitio web.
- **`index.html` va sin caché y todo lo demás un año.** Se puede porque cada
  `<script src>` lleva la huella de su contenido: si un archivo cambia, cambia
  su URL. La puerta de entrada es la única que tiene que pedirse siempre.
- **Antes de desplegar datos hay que pasar `tools/sella-versiones.py`**, que es
  lo que pone esas huellas. Sin ellas, el año de caché juega en contra.

## Lo que falta para la independencia completa


- **Páginas legales propias**: privacidad, cookies y aviso legal son hoy las de
  bonitu.es y Billions no enlaza ninguna. Pasan a ser obligatorias el día que se
  guarde un apodo en una clasificación.
- **Atribución de fuentes**: The Numbers, FilmAffinity y Wikipedia. Se quitaron
  todas las leyendas y no queda ninguna.
