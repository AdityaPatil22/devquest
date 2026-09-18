/**
 * Manages a single HTML <textarea> positioned over the Phaser canvas.
 * This is the only DOM element used in the entire game UI.
 */
export class GameTextInput {
  private textarea: HTMLTextAreaElement;

  constructor(parentElement: HTMLElement) {
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'devquest-textarea';
    parentElement.appendChild(this.textarea);
  }

  show(
    x: number,
    y: number,
    width: number,
    height: number,
    placeholder = ''
  ): void {
    this.textarea.style.display = 'block';
    this.textarea.style.left = `${x}px`;
    this.textarea.style.top = `${y}px`;
    this.textarea.style.width = `${width}px`;
    this.textarea.style.height = `${height}px`;
    this.textarea.placeholder = placeholder;
    this.textarea.value = '';

    requestAnimationFrame(() => this.textarea.focus());
  }

  hide(): void {
    this.textarea.style.display = 'none';
    this.textarea.value = '';
    this.textarea.blur();
  }

  getValue(): string {
    return this.textarea.value;
  }

  /** Check if the textarea currently has keyboard focus */
  hasFocus(): boolean {
    return document.activeElement === this.textarea;
  }
}
