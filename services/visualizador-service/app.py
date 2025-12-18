from flask import Flask, render_template, request, send_from_directory, abort, jsonify, g
import os
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error
import jwt  # PyJWT

app = Flask(__name__)

# ========= CONFIG UPLOADS =========
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ========= CONFIG DB =========
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345")
DB_NAME = os.getenv("DB_NAME", "smileworks")

# ========= CONFIG JWT =========
# OJO: DEBE COINCIDIR con el secret del auth-service (Node)
JWT_SECRET = os.getenv("JWT_SECRET", "VA5epMVF75S5rsu7B3wkQ1jxjcDQqZCbkxtZwT9Cr7JtaHbQ6ZSPsWb7ukTzxo69")
JWT_ALGOS = ["HS256"]


def get_db_connection():
    """Devuelve una conexión a MySQL."""
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )


# ==========================
#  AUTH / JWT
# ==========================
def _get_token_from_request():
    """
    Obtiene token desde:
      1) Authorization: Bearer <token>   (case-insensitive)
      2) cookie token=<token>
      3) querystring ?token=<token>
    """
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    cookie_token = request.cookies.get("token")
    if cookie_token and cookie_token.strip():
        return cookie_token.strip()

    t = request.args.get("token")
    if t and t.strip() and t.strip().lower() != "null":
        return t.strip()

    return None



def _decode_jwt(token: str):
    """Decodifica el JWT y regresa (payload, error_str)."""
    if not token:
        return None, "missing_token"

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=JWT_ALGOS,
            options={"require": ["exp", "iat"]}  # opcional pero recomendado
        )
        return payload, None

    except jwt.ExpiredSignatureError:
        return None, "expired"

    except jwt.InvalidSignatureError:
        return None, "bad_signature"

    except jwt.DecodeError:
        return None, "decode_error"

    except Exception as e:
        return None, f"other:{str(e)}"



@app.before_request
def protect_visualizador():
    """
    IMPORTANTE:
      - Dejamos PÚBLICO:
          /              (HTML del visor)
          /static/...     (css/js/libs)
          /uploads/...    (archivos porque <img> y Cornerstone NO mandan Authorization)
      - Protegemos:
          /api/...        (consultas a BD)
          /upload         (subida)
    """
    path = request.path

    # Público: HTML y assets
    if path == "/" or path.startswith("/static/"):
        return None

    # Público: servir archivos para Cornerstone/img
    if path.startswith("/uploads/"):
        return None

    # Protegido: API y upload
    if path.startswith("/api/") or path.startswith("/upload"):
        token = _get_token_from_request()
        payload, err = _decode_jwt(token)

        if not payload:
            return jsonify({
                "msg": "No autenticado",
                "reason": err,
                "has_auth_header": bool(request.headers.get("Authorization")),
                "has_query_token": bool(request.args.get("token")),
            }), 401

        g.user = payload
        return None



# ==========================
#  HELPERS DE PATHS
# ==========================
def _normalize_storage_path(storage_path: str) -> str:
    """
    Acepta:
      - "miimagen.png"
      - "/visualizador/uploads/miimagen.png"
      - "/uploads/miimagen.dcm"
    y devuelve el basename seguro: "miimagen.png"
    """
    if not storage_path:
        return None
    base = os.path.basename(str(storage_path))
    base = secure_filename(base)
    return base or None


def _to_viewer_path(storage_path: str) -> str:
    """
    Convierte patient_files.storage_path a una ruta consumible por el frontend:

      - "miimagen.dcm"               → "/visualizador/uploads/miimagen.dcm"
      - "/uploads/miimagen.dcm"      → "/visualizador/uploads/miimagen.dcm"
      - "/visualizador/uploads/..."  → "/visualizador/uploads/..."
    """
    if not storage_path:
        return None

    s = str(storage_path)
    if s.startswith('/visualizador/uploads/'):
        return s
    if s.startswith('/uploads/'):
        return '/visualizador' + s

    # nombre suelto o ruta rara -> forzamos
    return '/visualizador/uploads/' + s.lstrip('/')


# ==========================================
#  RUTA PRINCIPAL DEL VISOR
#  /visualizador?file=...              (1 archivo)
#  /visualizador?files=a,b,c           (rejilla/carrusel)
#  /visualizador?paciente=..&group=..  (modo por group)
# ==========================================
@app.route('/')
def index():
    file_arg    = request.args.get('file')
    files_arg   = request.args.get('files')
    group_arg   = request.args.get('group')
    paciente_id = request.args.get('paciente')

    filename  = None
    filenames = None

    # Modo multi: ?files=a,b,c
    if files_arg:
        raw_parts = [p.strip() for p in files_arg.split(',') if p.strip()]
        normalized = []
        for part in raw_parts:
            base = _normalize_storage_path(part)
            if not base:
                continue
            fullpath = os.path.join(app.config['UPLOAD_FOLDER'], base)
            if os.path.isfile(fullpath):
                normalized.append(base)

        if not normalized:
            abort(404, description="Ningún archivo válido encontrado en 'files'.")

        filenames = normalized

    # Modo single: ?file=...
    elif file_arg:
        filename = _normalize_storage_path(file_arg)
        if not filename:
            abort(400, description="Parámetro 'file' inválido.")

        fullpath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.isfile(fullpath):
            abort(404, description="Archivo no encontrado en uploads.")

    # Si viene group=, el JS hace fetch a /api/group/<group>/files (protegido)
    return render_template(
        'index.html',
        filename=filename,
        filenames=filenames,
        paciente_id=paciente_id,
        group_id=group_arg
    )


# ==========================================
#  API: archivos por group_id
#  GET /api/group/<group_id>/files
# ==========================================
@app.route('/api/group/<group_id>/files', methods=['GET'])
def api_group_files(group_id):
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            """
            SELECT
              id,
              paciente_id,
              group_id,
              tipo,
              storage_path,
              notas,
              fecha_subida
            FROM patient_files
            WHERE group_id = %s
            ORDER BY fecha_subida ASC
            """,
            (group_id,)
        )
        rows = cur.fetchall()

        files = []
        for r in rows:
            viewer_path = _to_viewer_path(r.get('storage_path'))
            files.append({
                "id": r.get("id"),
                "paciente_id": r.get("paciente_id"),
                "group_id": r.get("group_id"),
                "tipo": r.get("tipo"),
                "notas": r.get("notas") or "",
                "storage_path": viewer_path,
                "fecha_subida": (r.get("fecha_subida").isoformat() if r.get("fecha_subida") else None),
            })

        return jsonify({"group_id": group_id, "files": files})

    except Error as e:
        app.logger.exception("Error DB en /api/group/<group_id>/files")
        return jsonify({"error": "db_error", "message": str(e)}), 500

    except Exception as e:
        app.logger.exception("Error inesperado en /api/group/<group_id>/files")
        return jsonify({"error": "internal_error", "message": str(e)}), 500

    finally:
        try:
            if cur:
                cur.close()
        except Exception:
            pass
        try:
            if conn:
                conn.close()
        except Exception:
            pass


# ==========================================
#  SUBIDA (formulario directo al visualizador)
#  POST /upload
# ==========================================
@app.route('/upload', methods=['POST'])
def upload():
    files = request.files.getlist('imagen')
    if not files:
        return "No se recibió archivo", 400

    saved = []
    for file in files:
        if not file or not file.filename:
            continue

        filename = secure_filename(file.filename)
        if not filename:
            continue

        # Normaliza extensiones
        if "." not in filename:
            filename = filename + ".dcm"
        if filename.lower().endswith(".dicom"):
            filename = filename[:-6] + ".dcm"

        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        saved.append(filename)

    if not saved:
        return "Nombre(s) de archivo inválido(s)", 400

    if len(saved) == 1:
        return render_template('index.html', filename=saved[0], filenames=None)

    return render_template('index.html', filename=None, filenames=saved)


# ==========================================
#  SERVIR ARCHIVOS /uploads/<filename>
# ==========================================
@app.route('/uploads/<filename>')
def serve_image(filename):
    filename = secure_filename(filename)
    if not filename:
        abort(400, description="Nombre de archivo inválido.")

    if filename.lower().endswith(".dcm"):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename, mimetype='application/dicom')

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=3010, debug=False, use_reloader=False)
