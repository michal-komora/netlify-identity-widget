import netlifyIdentity from "./netlify-identity";


console.log("\n\n====================index====================\n\n")

if (typeof exports !== undefined) {
  console.log("typeof exports !== undefined")
  exports.netlifyIdentity = netlifyIdentity;
}
if (typeof window !== undefined) {
  console.log("typeof window !== undefined")
  window.netlifyIdentity = netlifyIdentity;
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("init netlifyIdentity");
    netlifyIdentity.init();
  });
} else {
  console.log("init netlifyIdentity");
  netlifyIdentity.init();
}
