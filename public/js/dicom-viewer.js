// Inicializar Cornerstone
cornerstone.init();

// Configurar el cargador de imágenes WADO
cornerstoneWADOImageLoader.configure({
    strict: false,
    beforeSend: function(xhr) {
        // Opcional: agregar headers
    }
});

// Variables globales
let imageIds = [];
let currentImageIndex = 0;
let isCinePlaying = false;
let cineInterval = null;

// Función para cargar archivos DICOM
async function loadDicomFiles(files) {
    imageIds = [];
    const thumbnailList = document.getElementById('thumbnail-list');
    thumbnailList.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.dcm')) {
            // Renombrar archivos sin extensión a .dcm
            const newName = file.name + '.dcm';
            const newFile = new File([file], newName, { type: file.type, lastModified: file.lastModified });
            file = newFile;
        }

        const url = URL.createObjectURL(file);
        const imageId = 'wadouri:' + url;
        imageIds.push(imageId);

        // Crear miniatura
        const thumbItem = document.createElement('div');
        thumbItem.className = 'thumbnail-item';
        thumbItem.textContent = file.name;
        thumbItem.addEventListener('click', () => {
            currentImageIndex = i;
            displayImage(i);
            document.querySelectorAll('.thumbnail-item').forEach(el => el.classList.remove('active'));
            thumbItem.classList.add('active');
        });
        thumbnailList.appendChild(thumbItem);
    }

    if (imageIds.length > 0) {
        displayImage(0);
    }
}

// Mostrar imagen en el canvas
async function displayImage(index) {
    if (index < 0 || index >= imageIds.length) return;

    try {
        const element = document.getElementById('dicom-canvas');
        const image = await cornerstone.loadImage(imageIds[index]);
        cornerstone.displayImage(element, image);

        // Activar herramientas
        activateTools();
    } catch (error) {
        console.error('Error al cargar la imagen:', error);
        alert('No se pudo cargar la imagen. Asegúrate de que sea un archivo DICOM válido.');
    }
}

// Activar herramientas de CornerstoneTools
function activateTools() {
    const element = document.getElementById('dicom-canvas');

    // Habilitar herramientas básicas
    cornerstoneTools.init();
    cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
    cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
    cornerstoneTools.addTool(cornerstoneTools.RotateTool);
    cornerstoneTools.addTool(cornerstoneTools.MirrorTool);
    cornerstoneTools.addTool(cornerstoneTools.LengthTool);
    cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool);
    cornerstoneTools.addTool(cornerstoneTools.CircleRoiTool);
    cornerstoneTools.addTool(cornerstoneTools.InvertTool);

    // Asignar herramientas a botones
    cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('Rotate', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('Mirror', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('Length', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('RectangleRoi', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('CircleRoi', { mouseButtonMask: 1 });
    cornerstoneTools.setToolActive('Invert', { mouseButtonMask: 1 });

    // Eventos de los botones
    document.getElementById('zoom-in').addEventListener('click', () => {
        cornerstoneTools.zoom.setConfiguration({ zoomFactor: 1.1 });
        cornerstoneTools.zoom.start();
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        cornerstoneTools.zoom.setConfiguration({ zoomFactor: 0.9 });
        cornerstoneTools.zoom.start();
    });

    document.getElementById('reset').addEventListener('click', () => {
        cornerstone.reset(document.getElementById('dicom-canvas'));
    });

    document.getElementById('invert').addEventListener('click', () => {
        cornerstoneTools.invert.start();
    });

    document.getElementById('rotate').addEventListener('click', () => {
        cornerstoneTools.rotate.start();
    });

    document.getElementById('mirror').addEventListener('click', () => {
        cornerstoneTools.mirror.start();
    });

    document.getElementById('cine').addEventListener('click', () => {
        toggleCine();
    });

    document.getElementById('measure').addEventListener('click', () => {
        cornerstoneTools.length.start();
    });

    document.getElementById('draw-rect').addEventListener('click', () => {
        cornerstoneTools.rectangleRoi.start();
    });

    document.getElementById('draw-circle').addEventListener('click', () => {
        cornerstoneTools.circleRoi.start();
    });

    document.getElementById('levels').addEventListener('click', () => {
        cornerstoneTools.wwwc.start();
    });
}

// Función para reproducir en modo cine
function toggleCine() {
    if (isCinePlaying) {
        clearInterval(cineInterval);
        isCinePlaying = false;
    } else {
        isCinePlaying = true;
        cineInterval = setInterval(() => {
            currentImageIndex++;
            if (currentImageIndex >= imageIds.length) {
                currentImageIndex = 0;
            }
            displayImage(currentImageIndex);
        }, 500); // Cambiar cada 500ms
    }
}

// Eventos de carga de archivos
document.getElementById('dicom-file-input').addEventListener('change', (e) => {
    loadDicomFiles(e.target.files);
});

document.getElementById('load-folder').addEventListener('click', () => {
    // En navegadores modernos, puedes usar el API File System Access para cargar carpetas
    // Pero por compatibilidad, mejor usar el input de archivos múltiples
    document.getElementById('dicom-file-input').click();
});

// Inicializar
window.addEventListener('DOMContentLoaded', () => {
    // Puedes cargar archivos predeterminados aquí si lo deseas
});