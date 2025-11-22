from flask import Flask, render_template, request, send_from_directory, abort
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
    base = os.path.basename(storage_path)
    base = secure_filename(base)
    if not base:
        return None
    return base


@app.route('/')
def index():
    """
    Soporta:
      - /?file=/visualizador/uploads/uno.dcm      → visor único
      - /?files=/visualizador/uploads/a.dcm,/visualizador/uploads/b.dcm → rejilla + carrusel
    """
    file_arg  = request.args.get('file')
    files_arg = request.args.get('files')

    filename  = None   # un solo archivo
    filenames = None   # lista de varios archivos

    # --------- MODO MULTI (rejilla/carrusel) ---------
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

    # --------- MODO ÚNICO (visor normal) ---------
    elif file_arg:
        filename = _normalize_storage_path(file_arg)
        if not filename:
            abort(400, description="Parámetro 'file' inválido.")

        fullpath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if not os.path.isfile(fullpath):
            abort(404, description="Archivo no encontrado en uploads.")

    # filename = una sola imagen (modo visor único)
    # filenames = lista de varias imágenes (modo rejilla 3x3)
    return render_template('index.html', filename=filename, filenames=filenames)


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
