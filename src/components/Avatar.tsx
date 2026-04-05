import React from 'react';

interface AvatarProps {
  name?: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, imageUrl, size = 40, className = '' }) => {
  const getInitials = () => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    backgroundColor: '#0d6efd',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: size * 0.4,
    textTransform: 'uppercase' as const,
  };

  if (imageUrl) {
    return <img src={imageUrl} alt="Avatar" style={style} className={className} />;
  }

  return (
    <div style={style} className={className}>
      {getInitials()}
    </div>
  );
};

export default Avatar;