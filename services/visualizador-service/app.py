from flask import Flask, render_template, request, send_from_directory, abort, jsonify
import os
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error

app = Flask(__name__)

# ========= CONFIG UPLOADS =========
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ========= CONFIG DB (ajusta si es necesario) =========
DB_HOST = 'localhost'
DB_USER = 'root'
DB_PASSWORD = '12345' 
DB_NAME = 'smileworks'



def get_db_connection():
    """Devuelve una conexión a MySQL."""
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )


def _normalize_storage_path(storage_path: str) -> str:
    """
    Acepta valores como:
      - "miimagen.png"
      - "/visualizador/uploads/miimagen.png"
      - "/uploads/miimagen.dcm"
    y devuelve sólo el basename asegurado: "miimagen.png"
    """
    if not storage_path:
        return None
    base = os.path.basename(storage_path)
    base = secure_filename(base)
    if not base:
        return None
    return base


def _to_viewer_path(storage_path: str) -> str:
    """
    Recibe lo que hay en patient_files.storage_path y lo convierte a
    una ruta que el frontend puede usar:

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
    # nombre suelto
    return '/visualizador/uploads/' + s.lstrip('/')


# ==========================================
#  RUTA PRINCIPAL DEL VISOR
#  /visualizador?file=...        (1 archivo)
#  /visualizador?files=a,b,c     (rejilla/carrusel)
#  /visualizador?paciente=..&group=.. (modo por grupo)
# ==========================================
@app.route('/')
def index():
    file_arg    = request.args.get('file')
    files_arg   = request.args.get('files')
    group_arg   = request.args.get('group')      # para compatibilidad si entras directo con ?group=
    paciente_id = request.args.get('paciente')   # de momento solo por si quieres mostrar algo

    filename  = None   # visor único
    filenames = None   # rejilla/carrusel

    # Si viene ?files= usamos eso (modo explícito antiguo)
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

    # Modo visor único (?file=...)
    elif file_arg:
        filename = _normalize_storage_path(file_arg)
        if not filename:
            abort(400, description="Parámetro 'file' inválido.")

        fullpath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.isfile(fullpath):
            abort(404, description="Archivo no encontrado en uploads.")

    # Si solo viene ?group= lo resuelve el JS con un fetch a /api/group/<group>/files
    # y rellena la rejilla/carrusel con esos archivos.

    return render_template(
        'index.html',
        filename=filename,
        filenames=filenames,
        paciente_id=paciente_id,
        group_id=group_arg
    )


# ==========================================
#  API: archivos por group_id (para viewer.js)
#  GET /api/group/<group_id>/files
#   → { group_id: "...", files: [ {id, storage_path_normalizado, tipo, notas, ...}, ... ] }
# ==========================================
@app.route('/api/group/<group_id>/files')
def api_group_files(group_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        # ✅ Usamos SOLO columnas que sí existen en patient_files
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
        cur.close()
        conn.close()

        files = []
        for r in rows:
            viewer_path = _to_viewer_path(r.get('storage_path'))
            files.append({
                "id": r.get("id"),
                "paciente_id": r.get("paciente_id"),
                "group_id": r.get("group_id"),
                "tipo": r.get("tipo"),
                "notas": r.get("notas") or "",
                "storage_path": viewer_path,  # 👉 ya en formato /visualizador/uploads/...
                "fecha_subida": (
                    r.get("fecha_subida").isoformat()
                    if r.get("fecha_subida") else None
                ),
            })

        return jsonify({
            "group_id": group_id,
            "files": files
        })

    except Error as e:
        app.logger.exception("Error al consultar patient_files por group_id")
        return jsonify({"error": "db_error", "message": str(e)}), 500
    except Exception as e:
        app.logger.exception("Error inesperado en /api/group/<group_id>/files")
        return jsonify({"error": "internal_error", "message": str(e)}), 500



# ==========================================
#  SUBIDA (formulario directo al visualizador)
# ==========================================
@app.route('/upload', methods=['POST'])
def upload():
    # Permite uno o varios archivos (carpeta)
    files = request.files.getlist('imagen')
    if not files:
        return "No se recibió archivo", 400

    saved = []
    for file in files:
        if not file or not file.filename:
            continue

        # Nombre base seguro
        filename = secure_filename(file.filename)
        if not filename:
            continue

        # Si NO tiene extensión → .dcm
        if "." not in filename:
            filename = filename + ".dcm"

        # Normalizar .dicom → .dcm
        if filename.lower().endswith(".dicom"):
            filename = filename[:-6] + ".dcm"

        # Guardar archivo ya normalizado
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        saved.append(filename)

    if not saved:
        return "Nombre(s) de archivo inválido(s)", 400

    # 1 solo archivo → visor normal
    if len(saved) == 1:
        return render_template('index.html', filename=saved[0], filenames=None)

    # Varios archivos → modo rejilla
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
    # recuerda: en producción lo levantas con start.sh (screen)
    app.run(host="0.0.0.0", port=3010, debug=False, use_reloader=False)
