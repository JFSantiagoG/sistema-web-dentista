from flask import Flask, render_template, request, send_from_directory
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files.get('imagen')
    if not file:
        return "No se recibió archivo", 400
    filename = secure_filename(file.filename)
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    return render_template('index.html', filename=filename)

@app.route('/uploads/<filename>')
def serve_image(filename):
    if filename.lower().endswith(".dcm"):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename, mimetype='application/dicom')
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
     app.run(host="0.0.0.0", port=3010, debug=False, use_reloader=False)
