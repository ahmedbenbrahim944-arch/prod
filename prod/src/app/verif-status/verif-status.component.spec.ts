import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerifStatusComponent } from './verif-status.component';

describe('VerifStatusComponent', () => {
  let component: VerifStatusComponent;
  let fixture: ComponentFixture<VerifStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerifStatusComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VerifStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
