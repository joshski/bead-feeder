interface FloatingActionButtonProps {
  onClick: () => void
  label?: string
  disabled?: boolean
}

function FloatingActionButton({
  onClick,
  label = 'Issue Assistant',
  disabled = false,
}: FloatingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: disabled ? '#9ca3af' : '#3b82f6',
        border: 'none',
        color: '#ffffff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? '0 2px 6px rgba(156, 163, 175, 0.3)'
          : '0 4px 12px rgba(59, 130, 246, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 900,
        transition: 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
        }
      }}
      data-testid="fab-issue-assistant"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>Plus</title>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  )
}

export default FloatingActionButton
