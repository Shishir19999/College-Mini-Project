// Responsive AVIF / WebP / JPEG image from /img (thali, cafe, restaurant), as in the original site.
const BASE = import.meta.env.BASE_URL;
const set = (name, ext) => `${BASE}img/${name}-600.${ext} 600w, ${BASE}img/${name}-1200.${ext} 1200w`;

export default function Picture({ name, alt = '', sizes = '100vw', width = 1200, height = 675, eager = false, parallax }) {
  return (
    <picture>
      <source type="image/avif" srcSet={set(name, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set(name, 'webp')} sizes={sizes} />
      <img
        src={`${BASE}img/${name}-1200.jpg`} srcSet={set(name, 'jpg')} sizes={sizes} alt={alt} width={width} height={height}
        loading={eager ? undefined : 'lazy'} fetchPriority={eager ? 'high' : undefined} data-parallax={parallax}
      />
    </picture>
  );
}
