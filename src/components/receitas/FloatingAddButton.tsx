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
        bottom: 'calc(116px + env(safe-area-inset-bottom, 0px))',
        right: 'calc(max(24px, calc(50% - 201px + 24px)) + env(safe-area-inset-right, 0px))',
        width: 70,
        height: 70,
        borderRadius: '50%',
        backgroundColor: '#B4ECFB',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0, 37, 78, 0.1)',
        zIndex: 95,
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
        color: '#000000',
      }}
    >
      <PlusIcon size={28} />
    </button>
  );
}
