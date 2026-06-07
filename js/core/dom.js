function getVal(id) {
  return document.getElementById(id).value;
}

function checked(type) {
  return document.querySelector(`[data-type="${type}"]`)?.checked ?? false;
}

function getHover() {
  const el = document.getElementById("showValues");
  return el && el.checked ? "x+y+name" : "skip";
}
