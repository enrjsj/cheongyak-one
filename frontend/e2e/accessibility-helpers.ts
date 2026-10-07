import { expect, type Locator } from '@playwright/test';

/** Focused regression checks, not a replacement for a full WCAG/axe audit. */
export async function expectAccessibleControls(root: Locator) {
  const controls = root.locator('button:visible, a[href]:visible, input:not([type="hidden"]):visible, select:visible, textarea:visible, [role="tab"]:visible');
  for (const control of await controls.all()) await expect(control).toHaveAccessibleName(/\S/);
  expect(await root.evaluate(element => [...element.querySelectorAll('[aria-labelledby], [aria-describedby]')].flatMap(node =>
    ['aria-labelledby', 'aria-describedby'].flatMap(attribute => (node.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)
      .filter(id => !document.getElementById(id)).map(id => `${attribute}: missing #${id}`)))), 'ARIA references must resolve').toEqual([]);
}

/** WCAG 1.4.3, for the app's solid surfaces. Unknown paint must fail, not silently pass. */
export async function expectTextContrast(root: Locator) {
  const result = await root.evaluate(element => {
    type Color = [number, number, number, number];
    const color = (value: string): Color => {
      const match = value.match(/^rgba?\(([^)]+)\)$/);
      if (!match) throw new Error(`Unsupported computed color: ${value}`);
      const channels = match[1].split(/[\s,\/]+/).map(Number);
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    };
    const composite = (front: Color, back: Color): Color => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [...front.slice(0, 3).map((channel, i) => (channel * front[3] + back[i] * back[3] * (1 - front[3])) / alpha), alpha] as Color;
    };
    const luminance = (value: Color) => value.slice(0, 3).map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const failures: string[] = [], unsupported: string[] = [];
    let checked = 0;
    for (const node of [element, ...element.querySelectorAll('*')]) {
      if (!(node instanceof HTMLElement) || !node.getClientRects().length || node.closest('[hidden], [aria-hidden="true"], [inert], :disabled')) continue;
      const style = getComputedStyle(node);
      if (style.visibility !== 'visible') continue;
      const text = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join('').trim();
      const input = node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node : null;
      const sample = text || (input ? input.value || input.placeholder : node instanceof HTMLSelectElement ? node.selectedOptions[0]?.text : '');
      if (!sample) continue;
      const label = `${node.tagName.toLowerCase()}.${node.className} ${sample.slice(0, 60)}`;
      const layers: Color[] = [];
      let background: Color = [255, 255, 255, 1], unknown = false, opaqueBackground = false;
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
        const paint = getComputedStyle(parent);
        // Ancestor compositing still affects descendants with opaque backgrounds.
        if (Number(paint.opacity) !== 1 || (!opaqueBackground && paint.backgroundImage !== 'none') || paint.filter !== 'none' || paint.mixBlendMode !== 'normal') {
          unsupported.push(`${label}: unsupported paint on ${parent.tagName}.${parent.className}`); unknown = true; break;
        }
        if (!opaqueBackground) {
          const layer = color(paint.backgroundColor); layers.push(layer);
          opaqueBackground = layer[3] === 1;
        }
      }
      if (unknown) continue;
      for (const layer of layers.reverse()) background = composite(layer, background);
      const textStyle = input && !input.value && input.placeholder ? getComputedStyle(node, '::placeholder') : style;
      const foreground = color(textStyle.color); foreground[3] *= Number(textStyle.opacity);
      const foregroundLuminance = luminance(composite(foreground, background)), backgroundLuminance = luminance(background);
      const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6667 && Number(style.fontWeight) >= 700);
      const threshold = large ? 3 : 4.5;
      checked++;
      if (ratio < threshold) failures.push(`${label}: ${ratio.toFixed(2)} < ${threshold} (${textStyle.color})`);
    }
    return { checked, failures, unsupported };
  });
  expect(result.unsupported, 'Manually review unsupported paint before extending this check').toEqual([]);
  expect(result.checked, 'Contrast scan must inspect rendered text').toBeGreaterThan(10);
  expect(result.failures, 'WCAG AA text contrast').toEqual([]);
}
