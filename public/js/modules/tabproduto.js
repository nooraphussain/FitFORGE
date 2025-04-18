export default function initTabProduto() {
  const imgPequena = document.querySelectorAll(
    "[data-tab-produto='imagem-pequena'] img"
  );
  const imgGrande = document.querySelectorAll(
    "[data-tab-produto='imagem-grande'] img"
  );
  if (imgPequena.length && imgGrande.length) {
    imgGrande[0].classList.add("ativo");
    function ativarTab(index) {
      imgGrande.forEach((imagem) => {
        imagem.classList.remove("ativo");
      });
      imgGrande[index].classList.add("ativo");
    
      // 💥 Reset scroll when image changes
      scrollIndex = 0;
      container.style.transform = `translateY(0px)`;
      updateButtons();
    
      // 💥 Force height recalculation but prevent over-scrolling
      setTimeout(() => {
        adjustContainerHeight();
        updateButtons(); // Recheck buttons after adjusting height
      }, 50);
    }
    

    imgPequena.forEach((item, index) => {
      item.addEventListener("click", () => {
        ativarTab(index);
      });
    });
  }
}





