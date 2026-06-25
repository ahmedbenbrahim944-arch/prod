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

  progressWidth      = '0%';
  progressTransition = 'none';
  private intervalId?: ReturnType<typeof setInterval>;
  private readonly DURATION_MS = 2 * 60 * 1000;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.startProgress(); }

  ngOnDestroy(): void { if (this.intervalId) clearInterval(this.intervalId); }

  private startProgress(): void {
    this.progressTransition = 'none';
    this.progressWidth = '0%';
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.progressTransition = `width ${this.DURATION_MS}ms linear`;
        this.progressWidth = '100%';
        this.cdr.detectChanges();
      });
    });
  }
}