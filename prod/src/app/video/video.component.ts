import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video.component.html',
  styleUrl: './video.component.css',   // ← CSS
})
export class VideoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;

  /** Affiché tant que l'utilisateur n'a pas interagi (politique autoplay navigateur) */
  showOverlay = signal(true);

  /** Chemin fixe vers la vidéo dans assets */
  readonly videoSrc = 'assets/videos/SERAF.mp4';

  ngAfterViewInit(): void {
    const video = this.videoRef.nativeElement;

    // Tentative d'autoplay silencieuse — certains navigateurs l'autorisent
    // si l'utilisateur a déjà interagi avec le site dans le passé.
    video.play().then(() => {
      this.showOverlay.set(false);
    }).catch(() => {
      // Le navigateur bloque → on garde l'overlay pour forcer une interaction
      this.showOverlay.set(true);
    });
  }

  /** Appelé au clic sur l'overlay — démarre la lecture avec son */
  startPlayback(): void {
    const video = this.videoRef.nativeElement;
    video.muted = false;
    video.play().then(() => {
      this.showOverlay.set(false);
    });
  }

  ngOnDestroy(): void {
    this.videoRef?.nativeElement?.pause();
  }
}