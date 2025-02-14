export default function initScrollSuave() {
  const linksInternos = document.querySelectorAll('a[href^="#"]');
  function ativarScroll(event) {
    event.preventDefault();
    const href = event.currentTarget.getAttribute("href");
    const section = document.querySelector(href);

    section.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  linksInternos.forEach((link) => {
    link.addEventListener("click", ativarScroll);
  });
}
