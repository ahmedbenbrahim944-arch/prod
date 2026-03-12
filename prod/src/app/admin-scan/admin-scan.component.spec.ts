import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminScanComponent } from './admin-scan.component';

describe('AdminScanComponent', () => {
  let component: AdminScanComponent;
  let fixture: ComponentFixture<AdminScanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminScanComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminScanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
