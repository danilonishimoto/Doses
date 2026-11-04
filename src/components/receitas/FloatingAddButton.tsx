import { PlusIcon } from '../../assets/icons';

interface FloatingAddButtonProps {
  onClick: () => void;
  label?: string;
}

export function FloatingAddButton({
  onClick,
  label = 'Adicionar nova receita',
}: FloatingAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="floating-add-recipe-btn"
      style={{
        position: 'fixed',
        bottom: 96,
        right: 'max(24px, calc(50% - 201px + 24px))',
        width: 70,
        height: 70,
        borderRadius: '50%',
        backgroundColor: '#B4ECFB',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(0, 37, 78, 0.25)',
        zIndex: 90,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        color: '#000000',
      }}
    >
      <PlusIcon size={28} />
    </button>
  );
}
