export function observeAboutSections(root, Observer) {
 if (!root || !Observer) return () => {};
 const animations = new Set();
 const observer = new Observer(entries => {
  for (const entry of entries) {
   if (!entry.isIntersecting) continue;
   observer.unobserve(entry.target);
   if (typeof entry.target.animate !== "function") continue;
   const animation = entry.target.animate(
    [{ opacity: 0.75, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
    { duration: 360, easing: "ease-out" }
   );
   animations.add(animation);
   animation.finished?.then(() => animations.delete(animation), () => animations.delete(animation));
  }
 }, { threshold: 0.12 });
 root.querySelectorAll(":scope > section").forEach(section => observer.observe(section));
 return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); animations.clear(); };
}
