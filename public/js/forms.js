// Funciones comunes para todos los formularios de dos pasos

// Mostrar paso del doctor
function showDoctorStep(formId = 'consentForm') {
    const form = document.getElementById(formId);
    if (form) {
        const doctorStep = form.querySelector('.doctor-section');
        const patientStep = form.querySelector('.patient-section');
        const step1Indicator = document.getElementById('step1-indicator');
        const step2Indicator = document.getElementById('step2-indicator');
        
        if (doctorStep && patientStep) {
            doctorStep.style.display = 'block';
            patientStep.style.display = 'none';
            
            if (step1Indicator) step1Indicator.className = 'step active';
            if (step2Indicator) step2Indicator.className = 'step';
        }
    }
}

// Mostrar paso del paciente
function showPatientStep(formId = 'consentForm') {
    const form = document.getElementById(formId);
    if (form) {
        const doctorStep = form.querySelector('.doctor-section');
        const patientStep = form.querySelector('.patient-section');
        
        if (doctorStep && patientStep) {
            // Validar campos requeridos del doctor
            const doctorFields = doctorStep.querySelectorAll('[required]');
            let allFilled = true;
            
            doctorFields.forEach(field => {
                if (!field.value.trim()) {
                    allFilled = false;
                    field.classList.add('is-invalid');
                } else {
                    field.classList.remove('is-invalid');
                }
            });
            
            if (!allFilled) {
                alert('❌ Por favor, complete todos los campos requeridos antes de continuar.');
                return;
            }
            
            doctorStep.style.display = 'none';
            patientStep.style.display = 'block';
            
            const step1Indicator = document.getElementById('step1-indicator');
            const step2Indicator = document.getElementById('step2-indicator');
            
            if (step1Indicator) step1Indicator.className = 'step completed';
            if (step2Indicator) step2Indicator.className = 'step active';
        }
    }
}

// Validación de formulario completo
function validatePatientForm(formId = 'consentForm') {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const patientStep = form.querySelector('.patient-section');
    if (!patientStep || patientStep.style.display === 'none') {
        alert('❌ Por favor, complete primero los datos del doctor y luego la confirmación del paciente.');
        return false;
    }
    
    // Verificar checkboxes requeridos
    const requiredCheckboxes = patientStep.querySelectorAll('[required][type="checkbox"]');
    let allChecked = true;
    
    requiredCheckboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            allChecked = false;
            checkbox.classList.add('is-invalid');
        } else {
            checkbox.classList.remove('is-invalid');
        }
    });
    
    // Verificar firmas
    const signatureInputs = patientStep.querySelectorAll('.signature-area + input[type="file"][required]');
    let signaturesProvided = true;
    
    signatureInputs.forEach(input => {
        if (!input.files || input.files.length === 0) {
            signaturesProvided = false;
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
    });
    
    if (!allChecked || !signaturesProvided) {
        alert('❌ Por favor, marque todas las casillas de verificación requeridas y proporcione las firmas.');
        return false;
    }
    
    return true;
}

// Inicializar formularios cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Configurar validación para todos los formularios con clase 'step-form'
    const stepForms = document.querySelectorAll('form.step-form');
    stepForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const formId = form.id || 'consentForm';
            if (validatePatientForm(formId)) {
                alert('✅ Formulario enviado correctamente!\n(En una implementación real, aquí se guardarían los datos)');
                // Aquí iría la lógica de envío real
            }
        });
    });
});

// Función auxiliar para mostrar alertas
function showNotification(message, type = 'info') {
    // Implementación básica de notificaciones
    alert(`${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
}

// Función para simular firma digital
function simulateSignature(signatureArea) {
    showNotification('Funcionalidad de firma digital - próximamente', 'info');
}