export default function initMenu(){
const menu = document.querySelector('[data-menu="btn-mobile"]')
const nav = document.querySelector('[data-menu="nav"]')

menu.addEventListener('click', () => {
    nav.classList.toggle('ativo')
});
}

