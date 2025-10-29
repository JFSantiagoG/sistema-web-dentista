from flask import Flask, render_template, request, send_from_directory, abort, url_for
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
    # Si viene con prefijos tipo /visualizador/uploads/..., quédate con el basename
    base = os.path.basename(storage_path)
    # Evitar path traversal
    base = secure_filename(base)
    if not base:
        return None
    return base

@app.route('/')
def index():
    # Soporta abrir directo: /visualizador?file=/visualizador/uploads/loquesea.dcm
    file_arg = request.args.get('file')
    filename = None
    if file_arg:
        filename = _normalize_storage_path(file_arg)
        if not filename:
            abort(400, description="Parámetro 'file' inválido.")

        # Asegura que el archivo exista en /uploads
        fullpath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.isfile(fullpath):
            abort(404, description="Archivo no encontrado en uploads.")

    # Si filename es None, se renderiza la página sin imagen (esperando upload)
    return render_template('index.html', filename=filename)

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files.get('imagen')
    if not file:
        return "No se recibió archivo", 400
    filename = secure_filename(file.filename)
    if not filename:
        return "Nombre de archivo inválido", 400
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    # Después de subir, reusa la misma vista con filename listo
    return render_template('index.html', filename=filename)

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
