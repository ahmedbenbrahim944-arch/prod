import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AffichageOverviewComponent } from './affichage-overview.component';

describe('AffichageOverviewComponent', () => {
  let component: AffichageOverviewComponent;
  let fixture: ComponentFixture<AffichageOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AffichageOverviewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AffichageOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
