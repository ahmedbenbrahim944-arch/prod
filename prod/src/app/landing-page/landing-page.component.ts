import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements OnInit, OnDestroy {

  private readonly SLIDE_COUNT  = 2;
  private readonly DURATION_MS  = 2 * 60 * 1000; // 2 minutes

  currentSlide    = 0;
  progressWidth   = '0%';
  progressTransition = 'none';

  private intervalId?: ReturnType<typeof setInterval>;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.startProgress();

    this.intervalId = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.SLIDE_COUNT;
      this.startProgress();
      this.cdr.detectChanges();
    }, this.DURATION_MS);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /** Reset the progress bar then animate it to 100 % over DURATION_MS. */
  private startProgress(): void {
    // Step 1 — reset instantly (no transition)
    this.progressTransition = 'none';
    this.progressWidth = '0%';
    this.cdr.detectChanges();

    // Step 2 — next animation frame: start the linear fill
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.progressTransition = `width ${this.DURATION_MS}ms linear`;
        this.progressWidth = '100%';
        this.cdr.detectChanges();
      });
    });
  }
}