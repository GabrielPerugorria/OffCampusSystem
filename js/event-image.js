'use strict';
/* ============================================================
   EvoTech Events — Módulo de Upload de Imagens de Eventos
   Integração direta com EvoAPI, preview, validação e UX fluida.
   ============================================================ */

(function () {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  let currentEventIdx = null;
  let selectedFile = null;
  let isUploading = false;

  const EventImageUI = {
    init() {
      const dropZone = document.getElementById('event-image-dropzone');
      const fileInput = document.getElementById('event-image-input');

      if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('is-dragover');
        });

        ['dragleave', 'dragend'].forEach(type => {
          dropZone.addEventListener(type, () => dropZone.classList.remove('is-dragover'));
        });

        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('is-dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            EventImageUI.handleFile(e.dataTransfer.files[0]);
          }
        });

        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            EventImageUI.handleFile(e.target.files[0]);
          }
        });
      }
    },

    open(idx) {
      if (typeof STATE === 'undefined' || !STATE.eventos || !STATE.eventos[idx]) {
        console.error('Evento não encontrado para upload de imagem.');
        return;
      }

      currentEventIdx = idx;
      selectedFile = null;
      isUploading = false;

      const ev = STATE.eventos[idx];
      const titleEl = document.getElementById('modal-event-image-title');
      const subEl = document.getElementById('modal-event-image-sub');
      const previewImg = document.getElementById('event-image-preview');
      const previewContainer = document.getElementById('event-image-preview-container');
      const placeholder = document.getElementById('event-image-placeholder');
      const fileInfo = document.getElementById('event-image-file-info');
      const submitBtn = document.getElementById('btn-save-event-image');
      const fileInput = document.getElementById('event-image-input');

      if (fileInput) fileInput.value = '';
      if (titleEl) titleEl.textContent = `Imagem do Evento — ${ev.nome}`;
      if (subEl) subEl.textContent = 'Dimensão recomendada: 1200x630px. Máximo 5MB (JPEG, PNG ou WebP).';

      // Exibe imagem atual se existir
      if (ev.imageUrl) {
        if (previewImg) previewImg.src = sanitizeURL(ev.imageUrl);
        if (previewContainer) previewContainer.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (fileInfo) fileInfo.textContent = 'Imagem cadastrada atualmente';
      } else {
        if (previewContainer) previewContainer.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        if (fileInfo) fileInfo.textContent = 'Nenhum arquivo selecionado';
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvar Imagem';
      }

      if (typeof openModal === 'function') {
        openModal('modal-event-image');
      }
    },

    close() {
      selectedFile = null;
      currentEventIdx = null;
      isUploading = false;
      if (typeof closeModal === 'function') {
        closeModal('modal-event-image');
      }
    },

    handleFile(file) {
      const fileInfo = document.getElementById('event-image-file-info');
      const previewImg = document.getElementById('event-image-preview');
      const previewContainer = document.getElementById('event-image-preview-container');
      const placeholder = document.getElementById('event-image-placeholder');
      const submitBtn = document.getElementById('btn-save-event-image');

      if (!file) return;

      // Validação de formato (MIME)
      if (!ALLOWED_TYPES.includes(file.type)) {
        if (typeof toast === 'function') {
          toast('Formato inválido. Envie apenas imagens JPG, PNG ou WebP.', 'error');
        }
        return;
      }

      // Validação de tamanho
      if (file.size > MAX_FILE_SIZE) {
        if (typeof toast === 'function') {
          toast(`Arquivo muito grande (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limite máximo de 5MB.`, 'error');
        }
        return;
      }

      selectedFile = file;

      // Renderiza prévia imediata no cliente
      const reader = new FileReader();
      reader.onload = function (e) {
        if (previewImg) previewImg.src = e.target.result;
        if (previewContainer) previewContainer.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (fileInfo) {
          const sizeKb = (file.size / 1024).toFixed(0);
          fileInfo.textContent = `${file.name} (${sizeKb} KB) — Pronto para envio`;
        }
        if (submitBtn) submitBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    },

    async submit() {
      if (isUploading) return;
      if (currentEventIdx === null || !STATE.eventos[currentEventIdx]) {
        toast('Evento inválido.', 'error');
        return;
      }
      if (!selectedFile) {
        toast('Selecione uma imagem antes de salvar.', 'error');
        return;
      }

      const ev = STATE.eventos[currentEventIdx];
      const submitBtn = document.getElementById('btn-save-event-image');
      isUploading = true;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-sm"></span> Enviando...';
      }

      try {
        const formData = new FormData();
        formData.append('image', selectedFile);

        const res = await EvoAPI.upload(`/events/${ev.id}/image`, formData);

        // Atualiza estado local imediatamente
        const newUrl = res.imageUrl || (res.imagePath ? `/${res.imagePath}` : '');
        ev.imagePath = res.imagePath || '';
        ev.imageUrl = newUrl;

        if (typeof toast === 'function') {
          toast('Imagem do evento atualizada com sucesso!', 'success');
        }

        EventImageUI.close();

        // Atualiza visualização na tabela de eventos
        if (typeof renderEventos === 'function') {
          renderEventos();
        }
      } catch (err) {
        console.error('Falha no upload da imagem:', err);
        const msg = err.message || 'Erro ao processar upload da imagem.';
        if (typeof toast === 'function') {
          toast(msg, 'error');
        }
      } finally {
        isUploading = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Salvar Imagem';
        }
      }
    }
  };

  window.EventImageUI = EventImageUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', EventImageUI.init);
  } else {
    EventImageUI.init();
  }
})();
