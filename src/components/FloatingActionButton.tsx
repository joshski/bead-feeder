interface FloatingActionButtonProps {
  onClick: () => void
  label?: string
}

function FloatingActionButton({
  onClick,
  label = 'Create Issue',
}: FloatingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: '#3b82f6',
        border: 'none',
        color: '#ffffff',
        fontSize: '28px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 900,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.1)'
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
      }}
      data-testid="fab-create-issue"
    >
      +
    </button>
  )
}

export default FloatingActionButton
