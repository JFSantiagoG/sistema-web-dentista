document.addEventListener("DOMContentLoaded", () => {
  function initSignaturePad(canvasId, clearBtnId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";

    let drawing = false;
    let enabled = false;

    // Mensaje inicial
    function drawMessage() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "16px Arial";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText("Haz click aquí para firmar", canvas.width / 2, canvas.height / 2);
    }
    drawMessage();

    // Coordenadas
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      if (e.touches && e.touches[0]) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        };
      } else {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }
    }

    // Desbloqueo con click
    canvas.addEventListener("click", () => {
      if (!enabled) {
        enabled = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    // Ratón
    canvas.addEventListener("mousedown", e => {
      if (!enabled) return;
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener("mousemove", e => {
      if (!enabled || !drawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });

    canvas.addEventListener("mouseup", () => (drawing = false));
    canvas.addEventListener("mouseleave", () => (drawing = false));

    // Touch
    canvas.addEventListener("touchstart", e => {
      if (!enabled) return;
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener("touchmove", e => {
      if (!enabled || !drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });

    canvas.addEventListener("touchend", () => (drawing = false));
    canvas.addEventListener("touchcancel", () => (drawing = false));

    // Limpiar
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        enabled = false;
        drawMessage();
      });
    }

    return () => canvas.toDataURL("image/png");
  }

  // Detecta todos los canvases de firma que tengas en la página
  document.querySelectorAll("canvas[id^='signature-pad']").forEach(canvas => {
    const id = canvas.id;
    const clearBtnId = "clear" + id.charAt(0).toUpperCase() + id.slice(1); // ej: signature-pad-paciente → clearSignature-pad-paciente
    const getterName = "get" + id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    window[getterName] = initSignaturePad(id, clearBtnId);
  });
});
