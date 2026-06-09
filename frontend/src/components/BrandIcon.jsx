export default function BrandIcon({ size = 36, style = {}, ...props }) {
  return (
    <span
      {...props}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'transparent',
        ...style,
      }}
    >
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </span>
  )
}
