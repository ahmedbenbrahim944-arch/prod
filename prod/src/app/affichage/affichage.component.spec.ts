import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AffichageComponent } from './affichage.component';

describe('AffichageComponent', () => {
  let component: AffichageComponent;
  let fixture: ComponentFixture<AffichageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AffichageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AffichageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
