// Funciones útiles para manejar modales
const ModalUtils = {
    // Mostrar modal con contenido personalizado
    show: function(title, content, onSaveCallback) {
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const saveBtn = document.getElementById('modalSaveBtn');
        
        if (modalTitle && modalBody && saveBtn) {
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
            
            // Configurar botón de guardar
            saveBtn.onclick = () => {
                if (onSaveCallback) {
                    onSaveCallback();
                }
            };
            
            // Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('modalBase'));
            modal.show();
        }
    },
    
    // Mostrar mensaje simple
    showMessage: function(title, message) {
        this.show(title, `<p>${message}</p>`, null);
    },
    
    // Mostrar confirmación
    confirm: function(title, message, onConfirm) {
        const content = `
            <p>${message}</p>
            <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">No</button>
                <button type="button" class="btn btn-danger" onclick="confirmAction()">Sí</button>
            </div>
        `;
        
        this.show(title, content, () => {
            if (onConfirm) {
                onConfirm();
            }
        });
        
        window.confirmAction = () => {
            if (onConfirm) {
                onConfirm();
            }
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalBase'));
            modal.hide();
        };
    }
};