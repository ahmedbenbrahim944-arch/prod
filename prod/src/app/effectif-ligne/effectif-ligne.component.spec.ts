import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EffectifLigneComponent } from './effectif-ligne.component';

describe('EffectifLigneComponent', () => {
  let component: EffectifLigneComponent;
  let fixture: ComponentFixture<EffectifLigneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EffectifLigneComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EffectifLigneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
