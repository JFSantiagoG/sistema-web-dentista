(function () {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1600,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  window.toastOk = (title, text = '') =>
    Toast.fire({ icon: 'success', title, text });

  window.toastInfo = (title, text = '') =>
    Toast.fire({ icon: 'info', title, text });

  window.toastErr = (title, text = '') =>
    Toast.fire({ icon: 'error', title, text });

  window.confirmDanger = async ({ title, text, confirmText = 'Sí, eliminar', cancelText = 'Cancelar' }) => {
    const r = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      confirmButtonColor: '#d33'
    });
    return r.isConfirmed;
  };

  window.loadingOn = (title = 'Procesando...', text = 'Espera un momento') => {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });
  };

  window.loadingOff = () => Swal.close();
})();
