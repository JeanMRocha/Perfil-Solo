/**
 * notify — Wrapper drop-in para notificações do PerfilSolo.
 *
 * Substitui o antigo `notifications.show()` do Mantine por `toast` do Sonner.
 * A API é propositalmente compatível com o padrão existente para facilitar
 * a busca-e-substituição em massa.
 *
 * Uso:
 *   import { notify } from '@/lib/notify';
 *   notify.success('Título', 'Mensagem');
 *   notify.error('Título', 'Mensagem detalhada');
 *   notify.info('Título', 'Mensagem');
 *   notify.warning('Título', 'Mensagem');
 *
 * Ou com a API compatível (drop-in do Mantine):
 *   notify.show({ title: 'Título', message: 'Mensagem', color: 'green' });
 */
import { toast } from 'sonner';

interface NotifyShowOptions {
    title?: string;
    message?: string;
    color?: string;
    id?: string;
    autoClose?: number | boolean;
    /** Ignored — Sonner handles icons automatically by toast type. Kept for Mantine compat. */
    icon?: unknown;
    /** Ignored — kept for Mantine compat. */
    loading?: boolean;
    /** Ignored — Sonner always shows close button (configured in Toaster). */
    withCloseButton?: boolean;
    /** Allow any extra keys without TS errors during migration. */
    [key: string]: unknown;
}

function mapColorToType(color?: string): 'success' | 'error' | 'info' | 'warning' {
    switch (color) {
        case 'green':
        case 'teal':
            return 'success';
        case 'red':
        case 'orange':
            return 'error';
        case 'yellow':
            return 'warning';
        case 'blue':
        case 'indigo':
        case 'cyan':
        default:
            return 'info';
    }
}

function getDuration(autoClose?: number | boolean): number | undefined {
    if (autoClose === false) return Infinity;
    if (typeof autoClose === 'number') return autoClose;
    return undefined; // use default
}

/**
 * Drop-in replacement for `notifications.show({ title, message, color })`.
 * Maps Mantine color to Sonner toast type.
 */
function show(options: NotifyShowOptions) {
    const type = mapColorToType(options.color);
    const duration = getDuration(options.autoClose);
    const toastOptions = {
        id: options.id,
        description: options.message,
        duration,
    };

    switch (type) {
        case 'success':
            toast.success(options.title ?? 'Sucesso', toastOptions);
            break;
        case 'error':
            toast.error(options.title ?? 'Erro', toastOptions);
            break;
        case 'warning':
            toast.warning(options.title ?? 'Aviso', toastOptions);
            break;
        case 'info':
        default:
            toast.info(options.title ?? 'Info', toastOptions);
            break;
    }
}

function success(title: string, message?: string) {
    toast.success(title, { description: message });
}

function error(title: string, message?: string) {
    toast.error(title, { description: message });
}

function info(title: string, message?: string) {
    toast.info(title, { description: message });
}

function warning(title: string, message?: string) {
    toast.warning(title, { description: message });
}

function clean() {
    toast.dismiss();
}

function hide(id: string) {
    toast.dismiss(id);
}

export const notify = {
    show,
    success,
    error,
    info,
    warning,
    clean,
    hide,
};
