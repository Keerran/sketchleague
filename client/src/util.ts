declare global {
    interface Window {
        fetchBackend(endpoint: String, init?: RequestInit): Promise<any>;
    }
}

Window.prototype.fetchBackend = function (endpoint: String, init?: RequestInit): Promise<any> {
    const location = window.location
    const host = location.hostname == "localhost" ? `${location.hostname}:8000` : location.hostname
    return fetch(`${location.protocol}//${host}/api${endpoint}`, init)
        .then(res => res.json());
}

export type Colour = { r: number; b: number; g: number }

export function capitalise(word: string) {
    return (word[0]?.toUpperCase() ?? "") + word.slice(1)
}

export function hexToRgb(hex: string): Colour | undefined {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : undefined;
}
