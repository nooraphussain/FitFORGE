export default function initScrollAnimado() {
  const scrollAnimado = document.querySelectorAll('[data-scroll="animado"]');
  const windowTamanho = window.innerHeight * 0.7;

  function animaScroll() {
    scrollAnimado.forEach((section) => {
      const sectionTop = section.getBoundingClientRect().top - windowTamanho;
      if (sectionTop < 0) {
        section.classList.add("ativo");
      } else {
        section.classList.remove("ativo");
      }
    });
  }
  animaScroll();
  window.addEventListener("scroll", animaScroll);
}
