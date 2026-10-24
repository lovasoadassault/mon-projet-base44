export default function Avatar({ user, className = '' }) {
  const cls = ['avatar', className].filter(Boolean).join(' ');
  if (user?.avatar) {
    return (
      <div
        className={`${cls} has-photo`}
        role="img"
        aria-label={user.username}
        style={{
          backgroundImage: `url(${user.avatar})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    );
  }
  return <div className={cls}>{(user?.username || '?')[0].toUpperCase()}</div>;
}
