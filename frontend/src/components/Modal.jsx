import React, { useEffect } from 'react';

/**
 * Modern Modal Component with backdrop blur and smooth animations
 * @param {Object} props
 * @param {boolean} props.isOpen - Control modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {boolean} props.closeOnBackdrop - Close when clicking backdrop
 * @param {string} props.size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {React.ReactNode} props.children - Modal content
 */
export function Modal({
    isOpen,
    onClose,
    title,
    closeOnBackdrop = true,
    size = 'md',
    children,
}) {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeMap = {
        sm: '400px',
        md: '600px',
        lg: '800px',
        xl: '1000px',
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 'var(--z-modal)',
                overflowY: 'auto',
                padding: 'var(--spacing-xl)',
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={closeOnBackdrop ? onClose : undefined}
        >
            <div
                className="stat-card"
                style={{
                    width: sizeMap[size],
                    maxWidth: '90%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    animation: 'scaleIn 0.3s ease-out',
                    position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-lg)',
                    paddingBottom: 'var(--spacing-md)',
                    borderBottom: '1px solid var(--border-light)',
                }}>
                    <h2 style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 700,
                        margin: 0,
                    }}>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        style={{
                            padding: '0.5rem',
                            minWidth: 'auto',
                            fontSize: '1.25rem',
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div>{children}</div>
            </div>
        </div>
    );
}

export default Modal;
