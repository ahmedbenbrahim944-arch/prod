import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlannMagScanComponent } from './plann-mag-scan.component';

describe('PlannMagScanComponent', () => {
  let component: PlannMagScanComponent;
  let fixture: ComponentFixture<PlannMagScanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlannMagScanComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlannMagScanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
