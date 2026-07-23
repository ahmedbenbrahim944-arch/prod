import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaquettesStatsComponent } from './plaquettes-stats.component';

describe('PlaquettesStatsComponent', () => {
  let component: PlaquettesStatsComponent;
  let fixture: ComponentFixture<PlaquettesStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaquettesStatsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlaquettesStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
