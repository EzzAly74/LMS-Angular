import { Pipe, PipeTransform } from '@angular/core';

/**
 * A person's name as shown in headers and greetings: the first `parts` names
 * (three by default, NEW2B-6186). HR names often carry four or five; the full
 * name stays available through a title.
 */
@Pipe({ name: 'shortName', standalone: true, pure: true })
export class ShortNamePipe implements PipeTransform {
  transform(name: string | null | undefined, parts = 3): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, Math.max(1, parts)).join(' ');
  }
}
