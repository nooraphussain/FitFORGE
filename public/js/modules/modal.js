export default function initModal() {
  const abrir = document.querySelector('[data-modal="conta"]');
  const fechar = document.querySelector('[data-modal="fechar"]');
  const modal = document.querySelector('[data-modal="modal"]');

  function toggleModal() {
    modal.classList.toggle("ativo");
  }

  function clickFora(event){
    if(event.target === this){
        toggleModal(event)
    }
  }

  abrir.addEventListener("click", toggleModal);
  fechar.addEventListener("click", toggleModal);
  modal.addEventListener('click', clickFora)
}